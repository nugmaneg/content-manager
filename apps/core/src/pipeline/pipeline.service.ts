import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient } from '../grpc';
import { AiProducer } from '../queues/ai.producer';

export interface ProcessStats {
  created: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly dbClient: DatabaseGrpcClient,
    private readonly aiProducer: AiProducer,
  ) { }

  /**
   * Универсальная обработка контента (любой источник)
   * Инкрементальная синхронизация: обрабатывает только новые сообщения
   */
  async processContent(source: any, rawMessages: any[]): Promise<ProcessStats> {
    // 1. Получить последний сохранённый externalId
    const lastContent = await this.dbClient.getLastContentForSource(source.id);
    const lastId = lastContent
      ? this.extractMessageId(lastContent.external_id)
      : 0;

    this.logger.debug(
      `Last synced message ID for source ${source.id}: ${lastId}`,
    );

    // 2. Фильтровать только новые сообщения (с ID > lastId)
    const newMessages = rawMessages.filter((m) => m.id > lastId);

    this.logger.log(
      `Processing ${newMessages.length} new messages (${rawMessages.length - newMessages.length} skipped as old)`,
    );

    const stats: ProcessStats = {
      created: 0,
      skipped: rawMessages.length - newMessages.length,
      errors: [],
    };

    // 3. Обработать каждое новое сообщение
    for (const message of newMessages) {
      try {
        await this.processMessage(source, message);
        stats.created++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        stats.errors.push(`Message ${message.id}: ${errorMsg}`);
        this.logger.error(`Failed to process message ${message.id}:`, err);
      }
    }

    return stats;
  }

  /**
   * @deprecated Используйте ContentPipelineProcessor для новой трёхэтапной архитектуры
   * Обработка одного сообщения:
   * 1. Создать Content в БД
   * 2. AI анализ (xAI)
   * 3. Эмбеддинг summary (OpenAI)
   * 4. Обновить Content с результатами
   * 
   * TODO: Мигрировать на новую архитектуру через ContentPipelineProducer.processRawContent()
   */
  private async processMessage(source: any, message: any) {
    const externalId = `${source.external_id}:${message.id}`;

    // Пропустить пустые сообщения
    if (!message.message || message.message.trim() === '') {
      this.logger.debug(`Skipping message ${message.id} - no text content`);
      throw new Error('No text content');
    }

    // 1. Создать Content
    this.logger.debug(
      `Creating content for message ${message.id}, externalId: ${externalId}`,
    );
    const content = await this.dbClient.createContent({
      externalId,
      sourceId: source.id,
      text: message.message,
      rawData: message,
      sourceDate: message.date
        ? new Date(message.date * 1000).toISOString()
        : undefined,
    });

    if (!content || !content.id) {
      this.logger.error(
        `Failed to create content for message ${message.id}: content or content.id is null`,
      );
      throw new Error('Content creation returned null or invalid ID');
    }

    this.logger.debug(
      `Created content ${content.id} for message ${message.id}`,
    );

    // DEPRECATED: Используйте ContentPipelineProcessor.handleProcessRawContent()
    // Этот метод оставлен для обратной совместимости, но не рекомендуется к использованию
    this.logger.warn(
      `[DEPRECATED] processMessage() is deprecated. Use ContentPipelineProcessor instead.`,
    );

    // Просто обновляем статус - анализ должен происходить через новый pipeline
    await this.dbClient.updateContent(content.id, {
      status: 'pending_analysis',
    });

    this.logger.debug(`Content ${content.id} marked for processing`);
  }

  /**
   * Извлечь ID сообщения из externalId формата "channel:messageId"
   */
  private extractMessageId(externalId: string): number {
    const parts = externalId.split(':');
    return parseInt(parts[parts.length - 1] || '0');
  }
}
