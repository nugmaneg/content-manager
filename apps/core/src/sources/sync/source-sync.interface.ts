export interface SyncOptions {
  limit?: number;
  minQualityScore?: number; // Минимальный порог качества для ContentUnit
}

export interface SyncResult {
  sourceId: string;
  sourceName: string;
  messagesProcessed: number;
  contentCreated: number;
  contentSkipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/**
 * Унифицированное сообщение из любого источника
 */
export interface SyncMessage {
  /** ID сообщения в рамках источника (например, Telegram message ID) */
  id: string;
  /** Текст сообщения */
  text: string;
  /** Медиа-вложения */
  media?: any;
  /** Метаданные специфичные для источника */
  sourceMeta: Record<string, any>;
  /** Дата получения/публикации */
  receivedAt: Date;
}

/**
 * Результат получения сообщений
 */
export interface FetchMessagesResult {
  /** Список сообщений в унифицированном формате */
  messages: SyncMessage[];
  /** Новый lastSyncedMessageId для обновления metadata */
  lastSyncedMessageId?: string;
}

/**
 * Базовый контракт для всех sync-адаптеров
 * Адаптер отвечает ТОЛЬКО за получение сообщений из внешнего API
 */
export interface SourceSyncService {
  /**
   * Получить сообщения из источника
   *
   * @param sourceId - ID источника в БД
   * @param options - параметры синхронизации
   * @returns Список сообщений в унифицированном формате
   */
  fetchMessages(
    sourceId: string,
    options: SyncOptions,
  ): Promise<FetchMessagesResult>;
}
