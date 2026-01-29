import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { QueuesModule } from '../queues/queues.module';
import { DatabaseGrpcClient } from '../grpc';
import { ContentPipelineModule } from './content';

/**
 * PipelineModule — объединяет все pipeline-ы для обработки контента.
 *
 * Включает:
 * - ContentPipelineModule: асинхронная обработка RawContent → ContentUnit → Topic
 *
 * Legacy:
 * - PipelineService: устаревший синхронный сервис (будет удалён)
 * - PipelineController: устаревший контроллер (будет удалён)
 */
@Module({
  imports: [
    QueuesModule,
    ContentPipelineModule, // Новый асинхронный pipeline
  ],
  controllers: [PipelineController], // @deprecated
  providers: [
    PipelineService, // @deprecated
    DatabaseGrpcClient,
  ],
  exports: [
    PipelineService, // @deprecated - для обратной совместимости
    ContentPipelineModule, // Реэкспортируем весь модуль, чтобы был доступен ContentPipelineProducer
  ],
})
export class PipelineModule { }
