import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
    imports: [QueuesModule],
    controllers: [PipelineController],
    providers: [PipelineService],
})
export class PipelineModule { }
