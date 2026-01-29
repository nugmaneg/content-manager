import { Module } from '@nestjs/common';
import { AiPromptsController } from './ai-prompts.controller';
import { AiPromptsService } from './ai-prompts.service';
import { DatabaseGrpcClient } from '../../grpc';

@Module({
  controllers: [AiPromptsController],
  providers: [AiPromptsService, DatabaseGrpcClient],
  exports: [AiPromptsService],
})
export class AiPromptsModule {}
