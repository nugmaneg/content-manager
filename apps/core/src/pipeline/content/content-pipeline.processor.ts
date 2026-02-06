import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
    QUEUE_CONTENT_PIPELINE,
    JOBS_CONTENT_PIPELINE,
    ProcessRawContentPayload,
    ProcessRawContentResult,
} from './content-pipeline.constants';
import { ContentOrchestrator } from './orchestrator/content-orchestrator.service';

type ContentPipelineJobPayload = ProcessRawContentPayload;

/**
 * ContentPipelineProcessor — лёгкий BullMQ диспетчер.
 *
 * Ответственность: только BullMQ integration
 * - Получает job из очереди
 * - Делегирует обработку ContentOrchestrator
 * - Возвращает результат
 *
 * Вся бизнес-логика находится в ContentOrchestrator.
 */
@Processor(QUEUE_CONTENT_PIPELINE)
@Injectable()
export class ContentPipelineProcessor extends WorkerHost {
    private readonly logger = new Logger(ContentPipelineProcessor.name);

    constructor(private readonly orchestrator: ContentOrchestrator) {
        super();
    }

    async process(
        job: Job<ContentPipelineJobPayload, ProcessRawContentResult, string>,
    ): Promise<ProcessRawContentResult> {
        this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);

        switch (job.name) {
            case JOBS_CONTENT_PIPELINE.processRawContent:
                return await this.orchestrator.processRawContent(
                    job.data as ProcessRawContentPayload,
                );

            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
                return {
                    rawContentId: '',
                    status: 'failed',
                    unitsCreated: 0,
                    topicsMatched: 0,
                    errorMessage: `Unknown job name: ${job.name}`,
                    durationMs: 0,
                };
        }
    }
}
