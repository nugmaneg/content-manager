import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { DatabaseGrpcClient } from '../grpc';
import { AuthModule } from '../auth';

@Module({
    imports: [AuthModule],
    controllers: [ContentController],
    providers: [DatabaseGrpcClient],
})
export class ContentModule { }
