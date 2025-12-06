import {Processor, WorkerHost} from '@nestjs/bullmq';
import {Injectable, Logger} from '@nestjs/common';
import {Job} from 'bullmq';
import {QUEUE_PARSER_SOURCE_TELEGRAM} from '../../../../queues/queues.constants';
import {TelegramMessageService} from '../services/telegram-message.service';

type TelegramParseJobPayload = {
    peer: string;
    message: string;
    sessionName?: string;
};

@Processor(QUEUE_PARSER_SOURCE_TELEGRAM)
@Injectable()
export class TelegramProcessor extends WorkerHost {
    private readonly logger = new Logger(TelegramProcessor.name);

    constructor(
        private readonly messageService: TelegramMessageService,
    ) {
        super();
    }

    async process(job: Job<TelegramParseJobPayload>) {
        const {peer, message, sessionName} = job.data;

        this.logger.debug(`Processing telegram job ${job.id} for peer ${peer}`);
        await this.messageService.sendMessage({peer, message, sessionName});

        return {status: 'sent'};
    }
}
