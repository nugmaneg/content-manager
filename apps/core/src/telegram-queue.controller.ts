import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ParseTelegramGetMessagePayload,
  ParseTelegramSendMessagePayload,
} from './queues/queues.constants';
import { TelegramParseProducer } from './queues/telegram-parse.producer';

@Controller('telegram')
export class TelegramQueueController {
  constructor(private readonly producer: TelegramParseProducer) {}

  @Post('send')
  async enqueueSend(@Body() body: ParseTelegramSendMessagePayload) {
    await this.producer.addMessageJob(body);
    return { status: 'queued' };
  }

  @Get('get')
  async getMessages(@Query() query: ParseTelegramGetMessagePayload) {
    const req = await this.producer.getMessagesJob(query);
    return { req };
  }
}
