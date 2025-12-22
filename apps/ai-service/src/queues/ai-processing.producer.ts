import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, JobsOptions, Queue, QueueEvents } from 'bullmq';
import {
  JOBS_AI,
  QUEUE_AI_PROCESSING,
  AnalyzeTextPayload,
  GenerateTextPayload,
} from './queues.constants';

@Injectable()
export class AiProcessingProducer {
  private readonly queueEvents: QueueEvents;
  private readonly defaultOptions: JobsOptions = {
    attempts: 3,
    removeOnComplete: true,
    backoff: {
      type: 'exponential',
      delay: 1_500,
    },
  };

  constructor(
    @InjectQueue(QUEUE_AI_PROCESSING)
    private readonly queue: Queue,
  ) {
    const { connection, prefix } = this.queue.opts;
    this.queueEvents = new QueueEvents(QUEUE_AI_PROCESSING, {
      connection,
      prefix,
    });
  }

  async enqueueGenerateText(
    payload: GenerateTextPayload,
    waitForResult = false,
  ): Promise<Job | any> {
    const job = await this.queue.add(
      JOBS_AI.generateText,
      payload,
      this.defaultOptions,
    );

    return waitForResult
      ? job.waitUntilFinished(this.queueEvents)
      : { jobId: job.id };
  }

  async enqueueAnalyzeText(
    payload: AnalyzeTextPayload,
    waitForResult = false,
  ): Promise<Job | any> {
    const job = await this.queue.add(
      JOBS_AI.analyzeText,
      payload,
      this.defaultOptions,
    );

    return waitForResult
      ? job.waitUntilFinished(this.queueEvents)
      : { jobId: job.id };
  }
}
