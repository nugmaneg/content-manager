import { Module } from '@nestjs/common';
import { TelegramModule } from './adapters/telegram/telegram.module';
import { TelegramController } from './adapters/telegram/controllers/telegram.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TELEGRAM_SERVICES } from './adapters/telegram/services/telegram-services';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    ConfigModule,
    QueuesModule,
    TelegramModule.registerAsync({
      imports: [ConfigModule, QueuesModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultSessionName: 'main',
        sessions: [
          {
            name: 'main',
            apiId: Number(configService.getOrThrow<number>('TG_MAIN_API_ID')),
            apiHash: configService.getOrThrow<string>('TG_MAIN_API_HASH'),
            sessionString: configService.getOrThrow<string>('TG_MAIN_SESSION'),
            connection: {
              connectionRetries: 5,
            },
          },
        ],
      }),
      services: TELEGRAM_SERVICES,
    }),
  ],
  controllers: [TelegramController],
})
export class SourcesModule {}
