import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

const CONTENT_COLLECTION = 'content_vectors';
const TOPIC_COLLECTION = 'topic_vectors';
const VECTOR_SIZE = 1536; // OpenAI/xAI embedding size

@Injectable()
export class QdrantService implements OnModuleInit {
    private readonly logger = new Logger(QdrantService.name);
    private client: QdrantClient;

    async onModuleInit() {
        const url = process.env.QDRANT_URL || 'http://localhost:6333';
        this.logger.log(`Connecting to Qdrant at ${url}...`);

        this.client = new QdrantClient({ url });

        // Проверяем/создаем коллекции
        await this.ensureCollection(CONTENT_COLLECTION);
        await this.ensureCollection(TOPIC_COLLECTION);
        this.logger.log('Successfully connected to Qdrant');
    }

    private async ensureCollection(name: string) {
        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === name);

            if (!exists) {
                this.logger.log(`Creating collection "${name}"...`);
                await this.client.createCollection(name, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine',
                    },
                });
                this.logger.log(`Collection "${name}" created`);
            }
        } catch (error) {
            this.logger.error(`Failed to ensure Qdrant collection "${name}"`, error);
            throw error;
        }
    }

    getClient(): QdrantClient {
        return this.client;
    }

    getContentCollectionName(): string {
        return CONTENT_COLLECTION;
    }

    getTopicCollectionName(): string {
        return TOPIC_COLLECTION;
    }

    /**
     * Сохраняет вектор в Qdrant
     */
    async upsertVector(collectionName: string, id: string, vector: number[], payload: Record<string, unknown>) {
        await this.client.upsert(collectionName, {
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
    async searchSimilar(collectionName: string, vector: number[], limit = 10, minScore?: number) {
        return this.client.search(collectionName, {
            vector,
            limit,
            score_threshold: minScore, // Фильтр по минимальному скору
            with_payload: true,
        });
    }
}
