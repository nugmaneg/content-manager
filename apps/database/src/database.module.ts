import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module';
import { DatabaseGrpcController } from './grpc/database.grpc.controller';
import { HealthController } from './health.controller';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    QueuesModule,
  ],
  controllers: [
    HealthController,
    DatabaseGrpcController,
  ],
  providers: [],
})
export class DatabaseModule { }
