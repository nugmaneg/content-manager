
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import {
  QUEUE_AI_PROCESSING,
  JOBS_AI,
  GenerateTextPayload,
  AnalyzeTextPayload,
  AiJobName,
} from '../queues/queues.constants';

type AiJobPayload = GenerateTextPayload | AnalyzeTextPayload;

@Processor(QUEUE_AI_PROCESSING)
export class AiProcessor extends WorkerHost {
    private readonly logger = new Logger(AiProcessor.name);

    constructor(private readonly providerFactory: AiProviderFactory) {
        super();
    }

    async process(job: Job<AiJobPayload, any, AiJobName>): Promise<any> {
        this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);

        try {
            switch (job.name) {
                case JOBS_AI.generateText:
                    return this.handleGenerateText(job.data as GenerateTextPayload);
                case JOBS_AI.analyzeText:
                    return this.handleAnalyzeText(job.data as AnalyzeTextPayload);
                default:
                    return this.logger.warn(`Unknown job name: ${job.name}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to process job ${job.name}: ${message}`, stack);
            throw error;
        }
    }

    private async handleGenerateText(data: GenerateTextPayload) {
        const providerName = data.provider || 'xai';
        const provider = this.providerFactory.getProvider(providerName);
        return await provider.generateText(data.prompt, data.options);
    }

    private async handleAnalyzeText(data: AnalyzeTextPayload) {
        const providerName = data.provider || 'xai';
        const provider = this.providerFactory.getProvider(providerName);
        return await provider.analyzeText(data.text);
    }
}
