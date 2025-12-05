import {Injectable} from "@nestjs/common";
import {TelegramService} from "../telegram.service";

@Injectable()
export class TelegramMessageService {
    constructor(private readonly telegram: TelegramService) {
    }

    /**
     * Удобный метод-обёртка для отправки сообщений.
     */
    async sendMessage(params: {
        peer: string;
        message: string;
        sessionName?: string;
    }): Promise<void> {
        const {peer, message, sessionName} = params;
        const client = this.telegram.getClient(sessionName);

        await client.sendMessage(peer, {message});
    }
}