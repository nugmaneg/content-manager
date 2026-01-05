import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient } from '../../grpc';
import { TelegramParseProducer } from '../../queues/telegram-parse.producer';
import { PipelineService } from '../../pipeline/pipeline.service';
import { SourceSyncService, SyncOptions, SyncResult } from '../sync/source-sync.interface';

@Injectable()
export class TelegramSyncService implements SourceSyncService {
    private readonly logger = new Logger(TelegramSyncService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly telegramProducer: TelegramParseProducer,
        private readonly pipelineService: PipelineService,
    ) { }

    async syncSource(sourceId: string, options: SyncOptions): Promise<SyncResult> {
        const startTime = Date.now();

        // 1. Получить source
        const source = await this.dbClient.getSource(sourceId);

        if (!source) {
            throw new Error(`Source not found: ${sourceId}`);
        }

        if (source.type !== 'telegram') {
            throw new Error(`TelegramSyncService can only sync telegram sources, got: ${source.type}`);
        }

        this.logger.log(`Starting Telegram sync for: ${source.name || source.external_id}`);

        // 2. Определить peer (username или channel ID)
        const peer = this.resolvePeer(source);

        // 3. Получить сообщения через Telegram Producer
        const result = await this.telegramProducer.getMessagesJob({
            peer,
            limit: options.limit || 50,
            offsetId: 0,
        });

        this.logger.log(`Fetched ${result.messages.length} messages from Telegram`);

        // 4. Обработать через универсальный Pipeline
        const stats = await this.pipelineService.processContent(source, result.messages);

        // 5. Обновить last_sync_at
        await this.dbClient.updateSource(source.id, {
            lastSyncAt: new Date().toISOString(),
        });

        // 6. Вернуть результат
        return {
            sourceId: source.id,
            sourceName: source.name || source.external_id,
            messagesProcessed: result.messages.length,
            contentCreated: stats.created,
            contentSkipped: stats.skipped,
            errors: stats.errors,
            startedAt: new Date(startTime).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
        };
    }

    /**
     * Определить peer: username из metadata или external_id как channel ID
     */
    private resolvePeer(source: any): string {
        const metadata = source.metadata_json ? JSON.parse(source.metadata_json) : {};
        return metadata.username || source.external_id;
    }
}
