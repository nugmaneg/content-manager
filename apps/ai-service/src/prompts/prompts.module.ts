import { Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { DatabaseGrpcClient } from '../grpc';

@Module({
  providers: [PromptsService, DatabaseGrpcClient],
  exports: [PromptsService],
})
export class PromptsModule {}
