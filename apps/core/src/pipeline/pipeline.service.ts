import { Injectable, Logger } from '@nestjs/common';
import { TelegramParseProducer } from '../queues/telegram-parse.producer';
import { AiProducer } from '../queues/ai.producer';

@Injectable()
export class PipelineService {
    private readonly logger = new Logger(PipelineService.name);

    constructor(
        private readonly telegramProducer: TelegramParseProducer,
        private readonly aiProducer: AiProducer,
    ) { }

    async processChannel(channelUsername: string, limit: number = 3) {
        this.logger.log(`Starting pipeline for channel: ${channelUsername} (limit: ${limit})`);

        // 1. Get messages from Telegram
        try {
            const tgResult = await this.telegramProducer.getMessagesJob({
                peer: channelUsername,
                offsetId: 0,
                limit: limit,
            });

            this.logger.log(`Fetched ${tgResult.messages.length} messages from Telegram`);

            const results: any[] = [];

            // 2. Process each message with AI
            for (const msg of tgResult.messages) {
                if (!msg.message) continue; // Skip empty messages (e.g. photos without caption)

                try {
                    this.logger.debug(`Analyzing message ID ${msg.id}...`);
                    const analysis = await this.aiProducer.analyzeText({
                        text: msg.message,
                        provider: 'xai' // Explicitly use xAI
                    });

                    results.push({
                        original_message: msg,
                        analysis: analysis,
                    });
                } catch (error) {
                    this.logger.error(`Failed to analyze message ${msg.id}`, error);
                    results.push({
                        original_message: msg,
                        error: error.message
                    });
                }
            }

            return {
                channel: channelUsername,
                total_processed: results.length,
                results: results
            };

        } catch (error) {
            this.logger.error(`Pipeline failed for ${channelUsername}`, error);
            throw error;
        }
    }
}
