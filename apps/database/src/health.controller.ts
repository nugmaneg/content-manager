import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './storage/prisma.service';
import { QdrantService } from './storage/qdrant.service';

@Controller()
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly qdrant: QdrantService,
    ) { }

    @Get()
    getInfo() {
        return {
            service: 'database',
            version: '1.0.0',
            description: 'Storage microservice for PostgreSQL and Qdrant',
        };
    }

    @Get('health')
    async health() {
        const healthData = {
            status: 'ok',
            checks: {
                postgres: 'unknown',
                qdrant: 'unknown',
            },
            timestamp: new Date().toISOString(),
        };

        // 1. Проверяем PostgreSQL (Prisma)
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            healthData.checks.postgres = 'connected';
        } catch (error) {
            healthData.status = 'error';
            healthData.checks.postgres = `disconnected: ${error.message}`;
        }

        // 2. Проверяем Qdrant
        try {
            await this.qdrant.getClient().getCollections();
            healthData.checks.qdrant = 'connected';
        } catch (error) {
            healthData.status = 'error';
            healthData.checks.qdrant = `disconnected: ${error.message}`;
        }

        return healthData;
    }
}
