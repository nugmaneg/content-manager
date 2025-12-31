import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    async onModuleInit() {
        this.logger.log('Connecting to PostgreSQL...');
        await this.$connect();
        this.logger.log('Successfully connected to PostgreSQL');
    }

    async onModuleDestroy() {
        this.logger.log('Disconnecting from PostgreSQL...');
        await this.$disconnect();
    }
}
