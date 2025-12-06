import {Module} from '@nestjs/common';
import {BullModule} from '@nestjs/bullmq';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {QUEUE_PARSER_SOURCE_TELEGRAM} from './queues.constants';

const telegramQueueRegistration = BullModule.registerQueue({
    name: QUEUE_PARSER_SOURCE_TELEGRAM,
});

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                prefix: config.get<string>('REDIS_PREFIX') ?? 'null',
                connection: {
                    ...(config.get<string>('REDIS_URL')
                        ? {url: config.getOrThrow<string>('REDIS_URL')}
                        : {
                            host: config.getOrThrow<string>('REDIS_HOST'),
                            port: config.getOrThrow<number>('REDIS_PORT'),
                            password: config.get<string>('REDIS_PASSWORD'),
                            username: config.get<string>('REDIS_USERNAME'),
                        }),
                },
                defaultJobOptions: {
                    removeOnComplete: true,
                },
            }),
        }),
        telegramQueueRegistration,
    ],
    exports: [telegramQueueRegistration],
})
export class QueuesModule {}
