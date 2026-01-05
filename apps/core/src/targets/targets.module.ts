import { Module } from '@nestjs/common';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';
import { DatabaseGrpcClient } from '../grpc';

@Module({
    controllers: [TargetsController],
    providers: [TargetsService, DatabaseGrpcClient],
    exports: [TargetsService],
})
export class TargetsModule { }
