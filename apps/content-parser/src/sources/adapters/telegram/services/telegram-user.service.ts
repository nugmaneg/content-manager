import { Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram.service';

@Injectable()
export class TelegramUserService {
  constructor(private readonly telegram: TelegramService) {}

  /**
   * При необходимости можно добавить другие high-level методы:
   * getMe, downloadMedia, и т.п., также с выбором сессии.
   */

  async getMe(sessionName?: string) {
    const client = this.telegram.getClient(sessionName);
    return client.getMe();
  }
}
