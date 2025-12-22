import { Provider } from '@nestjs/common';
import { TelegramMessageService } from './telegram-message.service';
import { TelegramUserService } from './telegram-user.service';

export const TELEGRAM_SERVICES: Provider[] = [
  TelegramMessageService,
  TelegramUserService,
];
