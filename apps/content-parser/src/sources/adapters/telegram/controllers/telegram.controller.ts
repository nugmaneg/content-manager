import { Body, Controller, Get, Post } from '@nestjs/common';
import { TelegramMessageService } from '../services/telegram-message.service';

@Controller('parser/sources/telegram')
export class TelegramController {
  constructor(private readonly telegramMessage: TelegramMessageService) {}

  @Get('ping')
  async ping() {
    return 'pong';
  }

  @Get('get/messages')
  async getMessages(
    @Body()
    dto: {
      peer: string;
      offsetId?: number;
      limit?: number;
      sessionName?: string;
    },
  ) {
    const messages = await this.telegramMessage.getMessages({
      peer: dto.peer,
      offsetId: dto.offsetId,
      limit: dto.limit,
      sessionName: dto.sessionName,
    });
    return { status: 'ok', data: messages };
  }

  @Post('send/message')
  async sendMessage(
    @Body() dto: { peer: string; message: string; sessionName?: string },
  ) {
    await this.telegramMessage.sendMessage({
      peer: dto.peer,
      message: dto.message,
      sessionName: dto.sessionName,
    });

    return { status: 'ok' };
  }
}
