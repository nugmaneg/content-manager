import {
  JOBS_TELEGRAM_SOURCE_PARSER,
  ParseTelegramSendMessagePayload,
  ParseTelegramGetMessagePayload,
  ParseTelegramMessageResult,
  QUEUE_TELEGRAM_PARSE as DEFAULT_QUEUE_TELEGRAM_PARSE,
  TelegramApiMessageContract,
  TelegramParserJobName,
} from '@queue-contracts/telegram';

// Queue name can be overridden via env (supports both keys), otherwise uses shared default.
export const QUEUE_TELEGRAM_PARSE =
  process.env.TELEGRAM_PARSER_QUEUE ??
  process.env.TELEGRAM_PARSE_QUEUE ??
  DEFAULT_QUEUE_TELEGRAM_PARSE;

export { JOBS_TELEGRAM_SOURCE_PARSER };
export type {
  ParseTelegramSendMessagePayload,
  ParseTelegramGetMessagePayload,
  ParseTelegramMessageResult,
  TelegramParserJobName,
  TelegramApiMessageContract,
};
