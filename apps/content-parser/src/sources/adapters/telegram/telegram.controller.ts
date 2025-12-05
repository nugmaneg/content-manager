import {Body, Controller, Get, Post} from '@nestjs/common';
import {TelegramMessageService} from "./services/telegram-message.service";

@Controller('parser/sources/telegram')
export class TelegramController {
    constructor(private readonly telegramMessage: TelegramMessageService) {
    }


    @Get('ping')
    async ping() {
        return 'pong';
    }

    @Post('send/message')
    async sendMessage(
        @Body() dto: { peer: string; message: string; sessionName?: string }
    ) {
        await this.telegramMessage.sendMessage({
            peer: dto.peer,
            message: dto.message,
            sessionName: dto.sessionName,
        });

        return {status: 'ok'};
    }
}
