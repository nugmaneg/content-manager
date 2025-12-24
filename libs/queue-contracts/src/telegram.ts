export const QUEUE_TELEGRAM_PARSE = 'telegram-parser' as const;
export const JOBS_TELEGRAM_SOURCE_PARSER = {
  sendMessage: 'sendMessage',
  getMessage: 'getMessage',
} as const;

export type TelegramParserJobName =
  (typeof JOBS_TELEGRAM_SOURCE_PARSER)[keyof typeof JOBS_TELEGRAM_SOURCE_PARSER];

export type ParseTelegramSendMessagePayload = {
  peer: string;
  message: string;
  sessionName?: string;
};

export type ParseTelegramGetMessagePayload = {
  peer: string;
  offsetId?: number;
  sessionName?: string;
  limit?: number;
};

export type ParseTelegramMessagePayload =
  | ParseTelegramSendMessagePayload
  | ParseTelegramGetMessagePayload;

// Облегчённые контракты, отражающие Telegram Api.* без импорта библиотеки.
export type PeerContract = {
  className?: string;
  channelId?: string | number;
  chatId?: string | number;
  userId?: string | number;
  accessHash?: string | number;
  [key: string]: unknown;
};

export type MessageFwdHeaderContract = {
  className?: string;
  fromId?: PeerContract;
  date?: number;
  savedFromPeer?: PeerContract;
  savedFromMsgId?: number;
  channelPost?: number;
  postAuthor?: string;
  imported?: boolean;
  [key: string]: unknown;
};

export type MessageReplyHeaderContract = {
  className?: string;
  replyToMsgId?: number;
  replyToPeerId?: PeerContract | null;
  replyFrom?: unknown;
  replyToTopId?: number;
  replyMedia?: unknown;
  forumTopic?: boolean;
  quote?: boolean;
  quoteText?: string | null;
  quoteEntities?: MessageEntityContract[] | null;
  quoteOffset?: number | null;
  [key: string]: unknown;
};

export type MessageEntityContract = {
  offset: number;
  length: number;
  className?: string;
  url?: string;
  language?: string;
  userId?: string | number;
  [key: string]: unknown;
};

export type MessageMediaContract = Record<string, unknown>;
export type ReplyMarkupContract = Record<string, unknown>;
export type MessageRepliesContract = Record<string, unknown>;
export type RestrictionReasonContract = Record<string, unknown>;
export type MessageActionContract = Record<string, unknown>;
export type MessageReactionsContract = Record<string, unknown>;

// Полноценный контракт, отражающий поля Telegram Api.Message.
export interface TelegramApiMessageContract {
  flags?: number; // Битовые флаги сообщения.
  flags2?: number; // Дополнительные флаги (flags2).
  id: number; // Идентификатор сообщения (всегда присутствует).
  peerId?: PeerContract; // Получатель/peer (канал/чат/пользователь).
  date: number; // UNIX-время отправки.
  message?: string; // Текст сообщения (если есть).
  out?: boolean; // Исходящее ли сообщение.
  mentioned?: boolean; // Есть ли упоминание пользователя.
  mediaUnread?: boolean; // Прочитано ли медиа.
  silent?: boolean; // Отправлено ли без звука.
  post?: boolean; // Пост ли это в канале.
  fromScheduled?: boolean; // Из отложенных сообщений.
  legacy?: boolean; // Устаревшее/legacy сообщение.
  editHide?: boolean; // Скрывать ли метку редактирования.
  pinned?: boolean; // Сообщение закреплено.
  noforwards?: boolean; // Запрет пересылки.
  fromId?: PeerContract; // Отправитель (peer user/chat/channel).
  fwdFrom?: MessageFwdHeaderContract; // Шапка пересылки.
  viaBotId?: string | number; // ID бота, через которого отправлено.
  viaBusinessBotId?: string | number; // ID бизнес-бота.
  replyTo?: MessageReplyHeaderContract; // Данные ответа.
  media?: MessageMediaContract; // Вложение/медиа.
  replyMarkup?: ReplyMarkupContract; // Клавиатура/markup.
  entities?: MessageEntityContract[]; // Список сущностей (bold/links/etc.).
  views?: number; // Количество просмотров.
  forwards?: number; // Количество пересылок.
  replies?: MessageRepliesContract; // Ответы/счётчик ответов.
  editDate?: number; // Время последнего редактирования.
  postAuthor?: string | null; // Подпись автора (для каналов).
  groupedId?: string | number | null; // Групповой ID (альбом/группа сообщений).
  restrictionReason?: RestrictionReasonContract | RestrictionReasonContract[]; // Причины ограничений.
  action?: MessageActionContract; // Сервисное действие (MessageService).
  ttlPeriod?: number | null; // Время жизни сообщения (секунды).
  reactions?: MessageReactionsContract; // Реакции.
  fromBoostsApplied?: unknown; // Были ли применены бусты отправителя.
  savedPeerId?: PeerContract; // Сохранённый peer (если Telegram вернул).
  invertMedia?: boolean; // Инвертировать ли медиа.
  videoProcessingPending?: boolean; // Видео в обработке.
  offline?: boolean; // Отправлено офлайн.
  quickReplyShortcutId?: number | null; // Быстрый ответ/shortcut.
  effect?: unknown; // Эффект/анимация.
  factcheck?: unknown; // Фактчек/проверка фактов.
  reportDeliveryUntilDate?: number | null; // До какого времени ожидать доставку.
  className?: string; // Имя класса/типа (служебно).
  raw?: unknown; // Полный сырой объект (если нужно хранить оригинал).
}

export type ParseTelegramMessageResult =
  | { status: 'sent' }
  | { status: 'received'; messages: TelegramApiMessageContract[] }
  | { status: 'skipped'; reason: 'unknown-job' };
