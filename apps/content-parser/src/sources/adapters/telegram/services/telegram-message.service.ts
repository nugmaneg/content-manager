import { Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { Api } from 'telegram';

@Injectable()
export class TelegramMessageService {
  constructor(private readonly telegram: TelegramService) {}

  /**
   * Удобный метод-обёртка для отправки сообщений.
   */
  async sendMessage(params: {
    peer: string;
    message: string;
    sessionName?: string;
  }): Promise<void> {
    const { peer, message, sessionName } = params;
    const client = this.telegram.getClient(sessionName);

    await client.sendMessage(peer, { message });
  }

  async getMessages(params: {
    peer: string;
    offsetId?: number;
    limit?: number;
    sessionName?: string;
  }): Promise<Api.Message[]> {
    const { peer, offsetId, limit = 50, sessionName } = params;
    const client = this.telegram.getClient(sessionName);

    const messages = await client.getMessages(peer, {
      offsetId: offsetId,
      reverse: !!offsetId,
      limit: limit,
    });

    return messages as Api.Message[];
  }
}
