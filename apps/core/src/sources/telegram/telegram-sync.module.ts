import { Module } from '@nestjs/common';
import { TelegramSyncService } from './telegram-sync.service';
import { QueuesModule } from '../../queues/queues.module';
import { DatabaseGrpcClient } from '../../grpc';

/**
 * TelegramSyncModule — модуль адаптера для получения сообщений из Telegram.
 *
 * Использует:
 * - QueuesModule: для TelegramParseProducer (получение сообщений через Telegram API)
 * - DatabaseGrpcClient: для получения Source и обновления metadata
 *
 * Не зависит от PipelineModule — обработка происходит через SourceSyncOrchestrator.
 */
@Module({
  imports: [
    QueuesModule, // для TelegramParseProducer
  ],
  providers: [TelegramSyncService, DatabaseGrpcClient],
  exports: [TelegramSyncService],
})
export class TelegramSyncModule { }
