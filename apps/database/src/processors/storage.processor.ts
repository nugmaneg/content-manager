import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../storage/prisma.service';
import { QdrantService } from '../storage/qdrant.service';
import {
    QUEUE_DATABASE_STORAGE,
    JOBS_DATABASE,
    SaveContentPayload,
    UpdateVectorPayload,
    UpdateAiAnalysisPayload,
} from '@queue-contracts/database';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

@Processor(QUEUE_DATABASE_STORAGE)
export class StorageProcessor extends WorkerHost {
    private readonly logger = new Logger(StorageProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly qdrant: QdrantService,
    ) {
        super();
    }

    async process(job: Job): Promise<unknown> {
        this.logger.debug(`Processing job ${job.name} [${job.id}]`);

        try {
            switch (job.name) {
                case JOBS_DATABASE.saveContent:
                    return await this.handleSaveContent(job.data as SaveContentPayload);

                case JOBS_DATABASE.updateVector:
                    return await this.handleUpdateVector(job.data as UpdateVectorPayload);

                case JOBS_DATABASE.updateAiAnalysis:
                    return await this.handleUpdateAiAnalysis(job.data as UpdateAiAnalysisPayload);

                default:
                    this.logger.warn(`Unknown job type: ${job.name}`);
                    return null;
            }
        } catch (error) {
            this.logger.error(`Failed to process job ${job.name}`, error);
            throw error;
        }
    }

    /**
     * Сохраняет новый контент в Postgres
     */
    private async handleSaveContent(payload: SaveContentPayload) {
        this.logger.log(`Saving content from ${payload.sourceType}:${payload.sourceExternalId}`);

        // 1. Upsert источник
        const source = await this.prisma.source.upsert({
            where: {
                type_externalId: {
                    type: payload.sourceType,
                    externalId: payload.sourceExternalId,
                },
            },
            update: {
                name: payload.sourceName ?? undefined,
            },
            create: {
                type: payload.sourceType,
                externalId: payload.sourceExternalId,
                name: payload.sourceName,
            },
        });

        // 2. Создаем или обновляем контент
        // Если externalId не передан — генерируем UUID, чтобы избежать перезаписи
        const contentExternalId = payload.externalId ?? uuidv4();
        const qdrantId = uuidv4();

        const content = await this.prisma.content.upsert({
            where: {
                sourceId_externalId: {
                    sourceId: source.id,
                    externalId: contentExternalId,
                },
            },
            update: {
                text: payload.text,
                rawData: payload.rawData as Prisma.InputJsonValue ?? Prisma.JsonNull,
                sourceDate: payload.sourceDate ? new Date(payload.sourceDate) : undefined,
            },
            create: {
                sourceId: source.id,
                externalId: contentExternalId,
                text: payload.text,
                rawData: payload.rawData as Prisma.InputJsonValue ?? Prisma.JsonNull,
                sourceDate: payload.sourceDate ? new Date(payload.sourceDate) : undefined,
                qdrantId,
            },
        });


        this.logger.log(`Content saved: ${content.id}`);

        return {
            id: content.id,
            sourceId: source.id,
            qdrantId: content.qdrantId,
        };
    }

    /**
     * Обновляет вектор контента в Qdrant
     */
    private async handleUpdateVector(payload: UpdateVectorPayload) {
        this.logger.log(`Updating vector for content ${payload.contentId}`);

        // Получаем контент
        const content = await this.prisma.content.findUnique({
            where: { id: payload.contentId },
        });

        if (!content) {
            throw new Error(`Content not found: ${payload.contentId}`);
        }

        // Если нет qdrantId — создаем
        const qdrantId = content.qdrantId ?? uuidv4();

        // Сохраняем вектор в Qdrant
        await this.qdrant.upsertVector(qdrantId, payload.vector, {
            contentId: content.id,
            text: content.text,
        });

        // Обновляем запись в Postgres
        await this.prisma.content.update({
            where: { id: content.id },
            data: {
                qdrantId,
                isVectorized: true,
            },
        });

        this.logger.log(`Vector updated for content ${payload.contentId}`);

        return { success: true, qdrantId };
    }

    /**
     * Обновляет результат AI анализа
     */
    private async handleUpdateAiAnalysis(payload: UpdateAiAnalysisPayload) {
        this.logger.log(`Updating AI analysis for content ${payload.contentId}`);

        const content = await this.prisma.content.update({
            where: { id: payload.contentId },
            data: {
                aiAnalysis: payload.analysis as Prisma.InputJsonValue,
            },
        });

        this.logger.log(`AI analysis updated for content ${payload.contentId}`);

        return { success: true, id: content.id };
    }
}
