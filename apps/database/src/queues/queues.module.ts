import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_DATABASE_STORAGE } from '@queue-contracts/database';
import { StorageProcessor } from '../processors/storage.processor';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const redisUrl = configService.get<string>('REDIS_URL');

                if (redisUrl) {
                    const url = new URL(redisUrl);
                    return {
                        connection: {
                            host: url.hostname,
                            port: parseInt(url.port, 10) || 6379,
                            password: url.password || undefined,
                            username: url.username || undefined,
                        },
                        prefix: configService.get<string>('REDIS_PREFIX', 'cm'),
                    };
                }

                return {
                    connection: {
                        host: configService.get<string>('REDIS_HOST', 'localhost'),
                        port: configService.get<number>('REDIS_PORT', 6379),
                        password: configService.get<string>('REDIS_PASSWORD'),
                        username: configService.get<string>('REDIS_USERNAME'),
                    },
                    prefix: configService.get<string>('REDIS_PREFIX', 'cm'),
                };
            },
        }),
        BullModule.registerQueue({
            name: QUEUE_DATABASE_STORAGE,
        }),
        StorageModule,
    ],
    providers: [StorageProcessor],
    exports: [BullModule],
})
export class QueuesModule { }
