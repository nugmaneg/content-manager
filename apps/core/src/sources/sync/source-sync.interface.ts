export interface SyncOptions {
    limit?: number;
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
 * Базовый контракт для всех sync-сервисов источников
 */
export interface SourceSyncService {
    /**
     * Синхронизировать источник
     */
    syncSource(sourceId: string, options: SyncOptions): Promise<SyncResult>;
}
