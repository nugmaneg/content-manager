// telegram/telegram.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { TELEGRAM_CLIENTS, TELEGRAM_MODULE_OPTIONS } from './telegram.tokens';
import { TelegramModuleOptions } from './telegram.types';
import { TelegramClientsMap } from './telegram.provider';

@Injectable()
export class TelegramService {
  constructor(
    @Inject(TELEGRAM_MODULE_OPTIONS)
    private readonly options: TelegramModuleOptions,
    @Inject(TELEGRAM_CLIENTS)
    private readonly clients: TelegramClientsMap,
  ) {}

  /**
   * Возвращает TelegramClient по имени сессии.
   * Если имя не задано — используется defaultSessionName или первая сессия из конфига.
   */
  getClient(sessionName?: string): TelegramClient {
    const resolvedName =
      sessionName ??
      this.options.defaultSessionName ??
      this.options.sessions[0]?.name;

    if (!resolvedName) {
      throw new Error('No Telegram sessions configured');
    }

    const client = this.clients.get(resolvedName);

    if (!client) {
      throw new Error(
        `Telegram client for session "${resolvedName}" not found`,
      );
    }

    return client;
  }
}
