import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import {
    AnalyzeTextPayload,
    JOBS_AI,
    QUEUE_AI_PROCESSING,
    AiAnalysisResult,
    GenerateTextPayload,
} from '@queue-contracts/ai';

@Injectable()
export class AiProducer {
    private readonly events: QueueEvents;

    constructor(
        @InjectQueue(QUEUE_AI_PROCESSING)
        private readonly queue: Queue,
    ) {
        const { connection, prefix } = this.queue.opts;
        this.events = new QueueEvents(QUEUE_AI_PROCESSING, {
            connection,
            prefix,
        });
    }

    async analyzeText(payload: AnalyzeTextPayload): Promise<AiAnalysisResult> {
        const job = await this.queue.add(
            JOBS_AI.analyzeText,
            payload,
            {
                removeOnComplete: true,
            }
        );
        return await job.waitUntilFinished(this.events);
    }

    async generateText(payload: GenerateTextPayload): Promise<string> {
        const job = await this.queue.add(
            JOBS_AI.generateText,
            payload,
            {
                removeOnComplete: true,
            }
        );
        return await job.waitUntilFinished(this.events);
    }
}
