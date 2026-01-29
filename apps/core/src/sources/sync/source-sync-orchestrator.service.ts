import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseGrpcClient } from '../../grpc';
import {
  SourceSyncService,
  SyncOptions,
  SyncResult,
  SyncMessage,
} from './source-sync.interface';
import { TelegramSyncService } from '../telegram/telegram-sync.service';
import { ContentPipelineProducer } from '../../pipeline/content';

@Injectable()
export class SourceSyncOrchestrator {
  private readonly logger = new Logger(SourceSyncOrchestrator.name);

  constructor(
    private readonly dbClient: DatabaseGrpcClient,
    private readonly moduleRef: ModuleRef,
    private readonly contentPipelineProducer: ContentPipelineProducer,
  ) {}

  /**
   * Главный метод синхронизации - определяет тип источника
   * и делегирует получение сообщений sync-адаптеру
   */
  async syncSource(
    sourceId: string,
    options: SyncOptions,
  ): Promise<SyncResult> {
    const startTime = Date.now();

    // 1. Получить source для определения типа
    const source = await this.dbClient.getSource(sourceId);

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // 2. Получить соответствующий sync-сервис
    const syncService = this.getSyncService(source.type);

    // 3. Делегировать получение сообщений адаптору
    this.logger.log(
      `Fetching messages from ${source.type} source: ${sourceId}`,
    );

    const fetchResult = await syncService.fetchMessages(sourceId, options);

    // 4. Обработать полученные сообщения (общая логика для всех источников)
    const stats = await this.processFetchedMessages(
      source,
      fetchResult.messages,
      options,
    );

    // 5. Обновить lastSyncAt
    await this.dbClient.updateSource(sourceId, {
      lastSyncAt: new Date().toISOString(),
    });

    return {
      sourceId: source.id,
      sourceName: source.name || source.external_id,
      messagesProcessed: fetchResult.messages.length,
      contentCreated: stats.created,
      contentSkipped: stats.skipped,
      errors: stats.errors,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Фабричный метод - возвращает нужный sync-сервис по типу
   */
  private getSyncService(sourceType: string): SourceSyncService {
    switch (sourceType) {
      case 'telegram':
        return this.moduleRef.get(TelegramSyncService, { strict: false });

      // Будущие источники:
      // case 'twitter':
      //     return this.moduleRef.get(TwitterSyncService, { strict: false });
      // case 'rss':
      //     return this.moduleRef.get(RssSyncService, { strict: false });

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  /**
   * Обработать полученные сообщения (ОБЩАЯ ЛОГИКА для всех источников)
   *
   * 1. Проверить дубликаты через checkRawContentExists
   * 2. Создать RawContent для новых сообщений
   * 3. Добавить в очередь content-pipeline
   */
  private async processFetchedMessages(
    source: any,
    messages: SyncMessage[],
    options: SyncOptions,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const stats = { created: 0, skipped: 0, errors: [] as string[] };

    if (messages.length === 0) {
      this.logger.log('No messages to process');
      return stats;
    }

    // Формируем externalIds для проверки
    const externalIds = messages.map(
      (msg) => `${source.external_id}:${msg.id}`,
    );

    // Проверка дубликатов (batch query)
    const existingIds = await this.dbClient.checkRawContentExists(
      source.id,
      externalIds,
    );

    this.logger.debug(
      `Found ${existingIds.size} existing messages out of ${messages.length}`,
    );

    // Обрабатываем только новые
    for (const message of messages) {
      const externalId = `${source.external_id}:${message.id}`;

      // Пропустить дубликаты
      if (existingIds.has(externalId)) {
        this.logger.debug(`Message ${message.id} already exists, skipping`);
        stats.skipped++;
        continue;
      }

      // Пропустить пустые сообщения
      if (!message.text?.trim()) {
        stats.skipped++;
        continue;
      }

      try {
        // Создать RawContent (без urls — AI извлечет при анализе)
        const rawContent = await this.dbClient.createRawContent({
          sourceId: source.id,
          externalId,
          text: message.text,
          media: message.media,
          sourceMeta: message.sourceMeta,
          receivedAt: message.receivedAt.toISOString(),
        });

        // Добавить в очередь обработки
        await this.contentPipelineProducer.enqueueRawContent({
          rawContentId: rawContent.id,
          options: {
            minQualityScore: options.minQualityScore,
          },
        });

        stats.created++;
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to process message ${message.id}: ${errorMsg}`,
        );
        stats.errors.push(`Message ${message.id}: ${errorMsg}`);
      }
    }

    this.logger.log(
      `Processing complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors.length} errors`,
    );

    return stats;
  }
}
