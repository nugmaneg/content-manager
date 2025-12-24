import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  JOBS_TELEGRAM_SOURCE_PARSER,
  ParseTelegramGetMessagePayload,
  ParseTelegramMessagePayload,
  ParseTelegramMessageResult,
  ParseTelegramSendMessagePayload,
  QUEUE_TELEGRAM_PARSE,
  TelegramParserJobName,
} from '../../../../queues/queues.constants';
import { TelegramMessageService } from '../services/telegram-message.service';

@Processor(QUEUE_TELEGRAM_PARSE)
@Injectable()
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(private readonly messageService: TelegramMessageService) {
    super();
  }

  async process(
    job: Job<
      ParseTelegramMessagePayload,
      ParseTelegramMessageResult,
      TelegramParserJobName
    >,
  ) {
    const { peer, sessionName } = job.data;

    this.logger.debug(
      `Processing telegram job ${job.id} for peer ${peer} (${job.name})`,
    );

    switch (job.name) {
      case JOBS_TELEGRAM_SOURCE_PARSER.sendMessage:
        const sendData = job.data as ParseTelegramSendMessagePayload;
        await this.messageService.sendMessage({
          peer,
          message: sendData.message,
          sessionName,
        });
        return { status: 'sent' };

      case JOBS_TELEGRAM_SOURCE_PARSER.getMessage:
        const getData = job.data as ParseTelegramGetMessagePayload;
        const messages = await this.messageService.getMessages({
          peer,
          offsetId: getData.offsetId,
          sessionName,
          limit: getData.limit, // Pass the limit
        });
        return { status: 'received', messages: messages };

      default:
        this.logger.warn(`Unknown job name "${job.name}" for telegram queue`);
        return { status: 'skipped', reason: 'unknown-job' };
    }
  }
}
