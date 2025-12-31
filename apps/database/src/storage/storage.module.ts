import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { QdrantService } from './qdrant.service';

@Module({
    providers: [PrismaService, QdrantService],
    exports: [PrismaService, QdrantService],
})
export class StorageModule { }
