import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import {
  JOBS_TELEGRAM_SOURCE_PARSER,
  QUEUE_TELEGRAM_PARSE,
} from './queues.constants';
import {
  ParseTelegramSendMessagePayload,
  ParseTelegramGetMessagePayload,
} from './queues.constants';

@Injectable()
export class TelegramParseProducer {
  private readonly events: QueueEvents;
  constructor(
    @InjectQueue(QUEUE_TELEGRAM_PARSE)
    private readonly queue: Queue,
  ) {
    const { connection, prefix } = this.queue.opts;
    this.events = new QueueEvents(QUEUE_TELEGRAM_PARSE, {
      connection,
      prefix,
    });
  }

  async addMessageJob(payload: ParseTelegramSendMessagePayload) {
    const job = await this.queue.add(
      JOBS_TELEGRAM_SOURCE_PARSER.sendMessage,
      payload,
      {
        attempts: 3,
        removeOnComplete: true,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
      },
    );
    return await job.waitUntilFinished(this.events);
  }

  async getMessagesJob(payload: ParseTelegramGetMessagePayload) {
    const job = await this.queue.add(
      JOBS_TELEGRAM_SOURCE_PARSER.getMessage,
      payload,
      {
        attempts: 3,
        removeOnComplete: true,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
      },
    );
    return await job.waitUntilFinished(this.events);
  }
}
