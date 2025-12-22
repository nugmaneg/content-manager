import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_AI_PROCESSING } from './queues.constants';

const aiProcessingQueueRegistration = BullModule.registerQueue({
  name: QUEUE_AI_PROCESSING,
});

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        prefix: config.get<string>('REDIS_PREFIX') ?? 'bull',
        connection: config.get<string>('REDIS_URL')
          ? { url: config.getOrThrow<string>('REDIS_URL') }
          : {
              host: config.getOrThrow<string>('REDIS_HOST'),
              port: config.getOrThrow<number>('REDIS_PORT'),
              password: config.get<string>('REDIS_PASSWORD'),
              username: config.get<string>('REDIS_USERNAME'),
            },
        defaultJobOptions: {
          removeOnComplete: true,
        },
      }),
    }),
    aiProcessingQueueRegistration,
  ],
  exports: [aiProcessingQueueRegistration],
})
export class QueuesModule {}
