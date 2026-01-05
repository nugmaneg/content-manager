import { Module } from '@nestjs/common';
import { WorkspaceDonorsController } from './workspace-donors.controller';
import { WorkspaceDonorsService } from './workspace-donors.service';
import { DatabaseGrpcClient } from '../grpc';

@Module({
    controllers: [WorkspaceDonorsController],
    providers: [WorkspaceDonorsService, DatabaseGrpcClient],
    exports: [WorkspaceDonorsService],
})
export class WorkspaceDonorsModule { }
