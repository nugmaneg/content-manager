import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, SourceResponse } from '../../grpc';
import { TelegramParseProducer } from '../../queues/telegram-parse.producer';
import {
  SourceSyncService,
  SyncOptions,
  FetchMessagesResult,
  SyncMessage,
} from '../sync/source-sync.interface';

/**
 * TelegramSyncService — адаптер для получения сообщений из Telegram.
 *
 * Ответственность (Single Responsibility):
 * - ТОЛЬКО получение сообщений из Telegram API
 * - Работа с lastSyncedMessageId (incremental sync)
 * - Возврат SyncMessage[] (унифицированный формат)
 *
 * НЕ отвечает за:
 * - Создание RawContent (это делает SourceSyncOrchestrator)
 * - Проверку дубликатов (это делает SourceSyncOrchestrator)
 * - Добавление в очередь (это делает SourceSyncOrchestrator)
 */
@Injectable()
export class TelegramSyncService implements SourceSyncService {
  private readonly logger = new Logger(TelegramSyncService.name);

  constructor(
    private readonly dbClient: DatabaseGrpcClient,
    private readonly telegramProducer: TelegramParseProducer,
  ) { }

  /**
   * Получить сообщения из Telegram (ТОЛЬКО получение, без создания RawContent)
   *
   * Поддерживает incremental sync через lastSyncedMessageId в metadata
   */
  async fetchMessages(
    sourceId: string,
    options: SyncOptions,
  ): Promise<FetchMessagesResult> {
    // 1. Получить source
    const source = await this.dbClient.getSource(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (source.type !== 'telegram') {
      throw new Error(
        `TelegramSyncService can only sync telegram sources, got: ${source.type}`,
      );
    }

    // 2. Определить peer
    const peer = this.resolvePeer(source);

    // 3. Прочитать metadata для incremental sync (Уровень 1 защиты)
    const metadata = source.metadata_json
      ? JSON.parse(source.metadata_json)
      : {};

    const lastMessageId = metadata.lastSyncedMessageId || 0;

    this.logger.log(
      `Fetching messages from Telegram (lastMessageId: ${lastMessageId}, limit: ${options.limit || 100})`,
    );

    // 4. Получить сообщения из Telegram API
    const result = await this.telegramProducer.getMessagesJob({
      peer,
      limit: options.limit || 100,
      offsetId: lastMessageId, // ✨ incremental sync
    });

    // 5. Фильтровать только новые (ID > lastMessageId)
    const newMessages = result.messages.filter(
      (msg) => parseInt(msg.id) > lastMessageId,
    );

    this.logger.log(`Received ${newMessages.length} new messages from Telegram`);

    // 6. Конвертировать в унифицированный формат SyncMessage[]
    const syncMessages: SyncMessage[] = newMessages.map((msg) => ({
      id: msg.id.toString(),
      text: msg.message || '',
      media: msg.media,
      sourceMeta: {
        messageId: msg.id,
        date: msg.date,
        views: msg.views,
        forwards: msg.forwards,
        editDate: msg.editDate,
      },
      receivedAt: msg.date ? new Date(msg.date * 1000) : new Date(),
    }));

    // 7. Определить новый lastSyncedMessageId
    const newLastMessageId = newMessages.length > 0
      ? Math.max(...newMessages.map((m) => parseInt(m.id)))
      : lastMessageId;

    // 8. Обновить metadata (специфично для Telegram)
    if (newLastMessageId > lastMessageId) {
      await this.dbClient.updateSource(source.id, {
        metadata: {
          ...metadata,
          lastSyncedMessageId: newLastMessageId,
        },
      });
    }

    return {
      messages: syncMessages,
      lastSyncedMessageId: newLastMessageId.toString(),
    };
  }

  /**
   * Определить peer: username из metadata или external_id как channel ID
   */
  private resolvePeer(source: SourceResponse): string {
    const metadata = source.metadata_json
      ? JSON.parse(source.metadata_json)
      : {};
    return metadata.username || source.external_id;
  }
}
