export interface TelegramSessionOptions {
    /**
     * Логическое имя сессии (например: "default", "main", "backup").
     * Должно быть уникальным в рамках модуля.
     */
    name: string;

    apiId: number;
    apiHash: string;

    /**
     * StringSession строка, заранее сгенерированная скриптом.
     */
    sessionString: string;

    /**
     * Опции коннекта (можно расширять по мере необходимости).
     */
    connection?: {
        connectionRetries?: number;
    };
}

export interface TelegramModuleOptions {
    /**
     * Имя сессии, которая будет использоваться по умолчанию
     * (если не указано явно в сервисе).
     * Если не задано — берётся первая из массива sessions.
     */
    defaultSessionName?: string;

    /**
     * Набор сессий, под каждую будет создан отдельный TelegramClient.
     */
    sessions: TelegramSessionOptions[];
}