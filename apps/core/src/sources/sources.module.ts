import { Module } from '@nestjs/common';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { SourceSyncOrchestrator } from './sync/source-sync-orchestrator.service';
import { TelegramSyncModule } from './telegram/telegram-sync.module';
import { AuthModule } from '../auth';
import { ContentPipelineModule } from '../pipeline/content';
import { DatabaseGrpcClient } from '../grpc';

@Module({
  imports: [
    AuthModule,
    ContentPipelineModule, // Для ContentPipelineProducer в SourceSyncOrchestrator
    TelegramSyncModule, // модульная поддержка Telegram
  ],
  controllers: [SourcesController],
  providers: [
    SourcesService,
    SourceSyncOrchestrator, // оркестратор вместо старого SourceSyncService
    DatabaseGrpcClient,
  ],
  exports: [SourcesService],
})
export class SourcesModule {}
