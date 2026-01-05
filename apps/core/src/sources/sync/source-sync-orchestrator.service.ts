import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseGrpcClient } from '../../grpc';
import { SourceSyncService, SyncOptions, SyncResult } from './source-sync.interface';
import { TelegramSyncService } from '../telegram/telegram-sync.service';

@Injectable()
export class SourceSyncOrchestrator {
    private readonly logger = new Logger(SourceSyncOrchestrator.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly moduleRef: ModuleRef,
    ) { }

    /**
     * Главный метод синхронизации - определяет тип источника
     * и делегирует нужному sync-сервису
     */
    async syncSource(sourceId: string, options: SyncOptions): Promise<SyncResult> {
        // 1. Получить source для определения типа
        const source = await this.dbClient.getSource(sourceId);

        if (!source) {
            throw new Error(`Source not found: ${sourceId}`);
        }

        // 2. Получить соответствующий sync-сервис
        const syncService = this.getSyncService(source.type);

        // 3. Делегировать синхронизацию
        this.logger.log(`Delegating sync of source ${sourceId} (${source.type}) to specialized sync service`);
        return await syncService.syncSource(sourceId, options);
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
}
