import { Module } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { DatabaseGrpcClient } from '../grpc';
import { AuthModule } from '../auth';

@Module({
    imports: [AuthModule],
    controllers: [TopicsController],
    providers: [DatabaseGrpcClient],
})
export class TopicsModule { }
