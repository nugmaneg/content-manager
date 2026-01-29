import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import {
    QUEUE_CONTENT_PIPELINE,
    JOBS_CONTENT_PIPELINE,
    ProcessRawContentPayload,
    ProcessRawContentResult,
} from './content-pipeline.constants';

/**
 * ContentPipelineProducer — добавляет задачи в очередь обработки контента.
 *
 * Используется TelegramSyncService и другими источниками для асинхронной
 * обработки сырого контента.
 */
@Injectable()
export class ContentPipelineProducer {
    private readonly logger = new Logger(ContentPipelineProducer.name);
    private readonly events: QueueEvents;

    constructor(
        @InjectQueue(QUEUE_CONTENT_PIPELINE)
        private readonly queue: Queue,
    ) {
        const { connection, prefix } = this.queue.opts;
        this.events = new QueueEvents(QUEUE_CONTENT_PIPELINE, {
            connection,
            prefix,
        });
    }

    /**
     * Добавить RawContent в очередь на обработку.
     * Возвращает Promise с результатом (дожидается завершения job-а).
     */
    async processRawContent(
        payload: ProcessRawContentPayload,
    ): Promise<ProcessRawContentResult> {
        this.logger.debug(
            `Adding job to process raw content: ${payload.rawContentId}`,
        );

        const job = await this.queue.add(
            JOBS_CONTENT_PIPELINE.processRawContent,
            payload,
            {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        return await job.waitUntilFinished(this.events);
    }

    /**
     * Добавить RawContent в очередь без ожидания результата.
     * Полезно для batch-обработки.
     */
    async enqueueRawContent(
        payload: ProcessRawContentPayload,
    ): Promise<string> {
        const job = await this.queue.add(
            JOBS_CONTENT_PIPELINE.processRawContent,
            payload,
            {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        this.logger.debug(`Enqueued job ${job.id} for raw content: ${payload.rawContentId}`);
        return job.id!;
    }

    /**
     * Добавить несколько RawContent в очередь (bulk).
     */
    async enqueueBatch(
        payloads: ProcessRawContentPayload[],
    ): Promise<string[]> {
        const jobs = await this.queue.addBulk(
            payloads.map((payload) => ({
                name: JOBS_CONTENT_PIPELINE.processRawContent,
                data: payload,
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false,
                    attempts: 3,
                },
            })),
        );

        this.logger.debug(`Enqueued ${jobs.length} jobs for batch processing`);
        return jobs.map((job) => job.id!);
    }
}
