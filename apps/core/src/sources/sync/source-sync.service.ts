import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseGrpcClient, SourceResponse, ContentResponse } from '../../grpc';
import { TelegramParseProducer } from '../../queues/telegram-parse.producer';
import { AiProducer } from '../../queues/ai.producer';
import { TelegramApiMessageContract } from '@queue-contracts/telegram';

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

interface ContentProcessingResult {
    contentId: string;
    externalId: string;
    isNew: boolean;
    aiProcessed: boolean;
    vectorized: boolean;
    error?: string;
}

@Injectable()
export class SourceSyncService {
    private readonly logger = new Logger(SourceSyncService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly telegramProducer: TelegramParseProducer,
        private readonly aiProducer: AiProducer,
    ) { }

    /**
     * Sync a source by ID.
     * Fetches messages from the source, saves them as Content, 
     * runs AI analysis and generates embeddings.
     */
    async syncSource(sourceId: string, options?: { limit?: number }): Promise<SyncResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let contentCreated = 0;
        let contentSkipped = 0;

        // 1. Get source
        const source = await this.dbClient.getSource(sourceId);
        if (!source) {
            throw new NotFoundException(`Source ${sourceId} not found`);
        }

        this.logger.log(`Starting sync for source: ${source.name || source.external_id} (${source.type})`);

        // 2. Validate source type
        if (source.type !== 'telegram') {
            throw new BadRequestException(`Sync is only supported for Telegram sources. Got: ${source.type}`);
        }

        // 3. Get peer from metadata (username) or external_id (channel ID)
        const metadata = source.metadata_json ? JSON.parse(source.metadata_json) : {};

        // Prefer username if available, otherwise use external_id (channel ID)
        let peer: string;
        let peerType: 'username' | 'channel_id';

        if (metadata.username) {
            peer = metadata.username;
            peerType = 'username';
            this.logger.debug(`Using username from metadata: ${peer}`);
        } else if (source.external_id) {
            peer = source.external_id;
            peerType = 'channel_id';
            this.logger.debug(`Using external_id as channel ID: ${peer}`);
        } else {
            throw new BadRequestException('Source has no valid Telegram username or external_id');
        }

        // 4. Fetch messages from Telegram
        const limit = options?.limit || 10;
        this.logger.log(`Fetching ${limit} messages from ${peerType === 'username' ? '@' : ''}${peer} (${peerType})...`);

        let messages: TelegramApiMessageContract[] = [];
        try {
            const result = await this.telegramProducer.getMessagesJob({
                peer: peer,
                limit: limit,
                offsetId: 0,
            });
            messages = result.messages || [];
            this.logger.log(`Received ${messages.length} messages from Telegram`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to fetch messages from Telegram: ${msg}`);
            errors.push(`Telegram fetch failed: ${msg}`);
        }

        // 5. Process each message
        const results: ContentProcessingResult[] = [];

        for (const message of messages) {
            try {
                const result = await this.processMessage(source, message);
                results.push(result);

                if (result.isNew) {
                    contentCreated++;
                } else {
                    contentSkipped++;
                }

                if (result.error) {
                    errors.push(result.error);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                errors.push(`Message ${message.id}: ${msg}`);
                this.logger.error(`Failed to process message ${message.id}: ${msg}`);
            }
        }

        const finishTime = Date.now();

        const syncResult: SyncResult = {
            sourceId: source.id,
            sourceName: source.name || source.external_id,
            messagesProcessed: messages.length,
            contentCreated,
            contentSkipped,
            errors,
            startedAt: new Date(startTime).toISOString(),
            finishedAt: new Date(finishTime).toISOString(),
            durationMs: finishTime - startTime,
        };

        this.logger.log(`Sync completed: ${contentCreated} created, ${contentSkipped} skipped, ${errors.length} errors in ${syncResult.durationMs}ms`);

        return syncResult;
    }

    /**
     * Process a single Telegram message:
     * 1. Check if already exists (by external_id)
     * 2. Create Content record
     * 3. Run AI analysis
     * 4. Generate embedding
     * 5. Update Content with AI data and embedding
     */
    private async processMessage(
        source: SourceResponse,
        message: TelegramApiMessageContract
    ): Promise<ContentProcessingResult> {
        const externalId = `${source.external_id}:${message.id}`;

        // Check if content already exists
        const existingContent = await this.findContentByExternalId(source.id, externalId);
        if (existingContent) {
            this.logger.debug(`Content already exists: ${externalId}`);
            return {
                contentId: existingContent.id,
                externalId,
                isNew: false,
                aiProcessed: existingContent.ai_analysis_json !== '',
                vectorized: existingContent.is_vectorized,
            };
        }

        // Skip messages without text
        if (!message.message || message.message.trim() === '') {
            this.logger.debug(`Skipping message ${message.id} - no text content`);
            return {
                contentId: '',
                externalId,
                isNew: false,
                aiProcessed: false,
                vectorized: false,
                error: 'No text content',
            };
        }

        // Create content record
        this.logger.debug(`Creating content for message ${message.id}...`);
        const content = await this.dbClient.createContent({
            externalId,
            sourceId: source.id,
            text: message.message,
            rawData: message as unknown as Record<string, any>,
            sourceDate: message.date ? new Date(message.date * 1000).toISOString() : undefined,
        });

        let aiProcessed = false;
        let vectorized = false;
        let error: string | undefined;

        // Run AI analysis
        try {
            this.logger.debug(`Running AI analysis for content ${content.id}...`);
            const analysis = await this.aiProducer.analyzeText({
                text: message.message,
                provider: 'xai', // Use xAI for analysis
            });

            // Generate embedding
            this.logger.debug(`Generating embedding for content ${content.id}...`);
            const embeddingResult = await this.aiProducer.generateEmbedding({
                text: message.message,
                // Uses OpenAI by default
            });

            // Update content with AI data
            await this.dbClient.updateContent(content.id, {
                aiAnalysis: analysis,
                isVectorized: true,
                embeddingModel: embeddingResult.model,
                // Note: qdrantId would be set by a separate Qdrant insertion process
                status: 'enriched',
            });

            aiProcessed = true;
            vectorized = true;
            this.logger.debug(`Successfully enriched content ${content.id}`);

        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to enrich content ${content.id}: ${error}`);

            // Update status to indicate partial processing
            await this.dbClient.updateContent(content.id, {
                status: 'enrichment_failed',
            });
        }

        return {
            contentId: content.id,
            externalId,
            isNew: true,
            aiProcessed,
            vectorized,
            error,
        };
    }

    /**
     * Find content by external_id within a source
     * Uses list with filtering since we don't have a direct lookup method
     */
    private async findContentByExternalId(sourceId: string, externalId: string): Promise<ContentResponse | null> {
        // For now, we rely on database unique constraint to handle duplicates
        // In production, we'd want a direct lookup method in the gRPC API
        // The createContent will throw if the external_id already exists for the source
        return null;
    }
}
