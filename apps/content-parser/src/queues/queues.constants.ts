// Имя очереди можно переопределить через env, иначе используется дефолт.
export const QUEUE_PARSER_SOURCE_TELEGRAM =
    process.env.TELEGRAM_PARSER_QUEUE ?? 'telegram-parser';
