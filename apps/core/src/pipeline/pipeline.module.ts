import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { QueuesModule } from '../queues/queues.module';
import { DatabaseGrpcClient } from '../grpc';

@Module({
    imports: [QueuesModule],
    controllers: [PipelineController],
    providers: [PipelineService, DatabaseGrpcClient],
    exports: [PipelineService],  // экспортируем для использования в других модулях
})
export class PipelineModule { }

