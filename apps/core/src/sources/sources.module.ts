import { Module } from '@nestjs/common';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { SourceSyncOrchestrator } from './sync/source-sync-orchestrator.service';
import { TelegramSyncModule } from './telegram/telegram-sync.module';
import { AuthModule } from '../auth';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DatabaseGrpcClient } from '../grpc';

@Module({
    imports: [
        AuthModule,
        PipelineModule,
        TelegramSyncModule,  // модульная поддержка Telegram
    ],
    controllers: [SourcesController],
    providers: [
        SourcesService,
        SourceSyncOrchestrator,  // оркестратор вместо старого SourceSyncService
        DatabaseGrpcClient,
    ],
    exports: [SourcesService],
})
export class SourcesModule { }



