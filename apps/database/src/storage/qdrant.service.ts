import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

const CONTENT_COLLECTION = 'content_vectors';
const VECTOR_SIZE = 1536; // OpenAI/xAI embedding size

@Injectable()
export class QdrantService implements OnModuleInit {
    private readonly logger = new Logger(QdrantService.name);
    private client: QdrantClient;

    async onModuleInit() {
        const url = process.env.QDRANT_URL || 'http://localhost:6333';
        this.logger.log(`Connecting to Qdrant at ${url}...`);

        this.client = new QdrantClient({ url });

        // Проверяем/создаем коллекцию для контента
        await this.ensureCollection();
        this.logger.log('Successfully connected to Qdrant');
    }

    private async ensureCollection() {
        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === CONTENT_COLLECTION);

            if (!exists) {
                this.logger.log(`Creating collection "${CONTENT_COLLECTION}"...`);
                await this.client.createCollection(CONTENT_COLLECTION, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine',
                    },
                });
                this.logger.log(`Collection "${CONTENT_COLLECTION}" created`);
            }
        } catch (error) {
            this.logger.error('Failed to ensure Qdrant collection', error);
            throw error;
        }
    }

    getClient(): QdrantClient {
        return this.client;
    }

    getCollectionName(): string {
        return CONTENT_COLLECTION;
    }

    /**
     * Сохраняет вектор в Qdrant
     */
    async upsertVector(id: string, vector: number[], payload: Record<string, unknown>) {
        await this.client.upsert(CONTENT_COLLECTION, {
            points: [
                {
                    id,
                    vector,
                    payload,
                },
            ],
        });
    }

    /**
     * Поиск похожих векторов
     */
    async searchSimilar(vector: number[], limit = 10, minScore?: number) {
        return this.client.search(CONTENT_COLLECTION, {
            vector,
            limit,
            score_threshold: minScore, // Фильтр по минимальному скору
            with_payload: true,
        });
    }
}
