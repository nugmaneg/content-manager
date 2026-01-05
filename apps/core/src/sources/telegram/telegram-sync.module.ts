import { Module } from '@nestjs/common';
import { TelegramSyncService } from './telegram-sync.service';
import { QueuesModule } from '../../queues/queues.module';
import { PipelineModule } from '../../pipeline/pipeline.module';
import { DatabaseGrpcClient } from '../../grpc';

@Module({
    imports: [
        QueuesModule,      // для TelegramParseProducer
        PipelineModule,    // для PipelineService
    ],
    providers: [TelegramSyncService, DatabaseGrpcClient],
    exports: [TelegramSyncService],
})
export class TelegramSyncModule { }
