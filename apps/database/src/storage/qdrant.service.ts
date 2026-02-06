import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

const CONTENT_COLLECTION = 'content_vectors';
const CONTENT_UNITS_COLLECTION = 'content_units'; // NEW: для ContentUnit
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
    await this.ensureCollection(CONTENT_UNITS_COLLECTION); // NEW
    await this.ensureCollection(TOPIC_COLLECTION);
    this.logger.log('Successfully connected to Qdrant');
  }

  private async ensureCollection(name: string) {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === name);

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

  getContentUnitsCollectionName(): string {
    return CONTENT_UNITS_COLLECTION;
  }

  getTopicCollectionName(): string {
    return TOPIC_COLLECTION;
  }

  /**
   * Сохраняет вектор в Qdrant
   */
  async upsertVector(
    collectionName: string,
    id: string,
    vector: number[],
    payload: Record<string, unknown>,
  ) {
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
  async searchSimilar(
    collectionName: string,
    vector: number[],
    limit = 10,
    minScore?: number,
  ) {
    return this.client.search(collectionName, {
      vector,
      limit,
      score_threshold: minScore, // Фильтр по минимальному скору
      with_payload: true,
    });
  }

  // ===================================
  // CONTENT UNIT SPECIFIC METHODS
  // ===================================

  /**
   * Upsert вектор ContentUnit в отдельную коллекцию
   */
  async upsertContentUnitVector(
    unitId: string,
    data: {
      vector: number[];
      summary?: string;
      contentType?: string;
      language?: string;
    },
  ): Promise<{ qdrantId: string }> {
    // Генерируем UUID для Qdrant (или можно использовать unitId напрямую)
    const qdrantId = uuidv4();

    await this.client.upsert(CONTENT_UNITS_COLLECTION, {
      points: [
        {
          id: qdrantId,
          vector: data.vector,
          payload: {
            unit_id: unitId,
            summary: data.summary || '',
            content_type: data.contentType || '',
            language: data.language || '',
          },
        },
      ],
    });

    this.logger.debug(`Upserted vector for unit ${unitId}: qdrantId=${qdrantId}`);
    return { qdrantId };
  }

  /**
   * Поиск похожих ContentUnit-ов по qdrantId
   */
  async searchSimilarUnits(
    qdrantId: string,
    options: { limit?: number; minScore?: number },
  ): Promise<Array<{ unitId: string; topicId: string; qdrantId: string; score: number }>> {
    // Получить вектор по qdrantId
    const points = await this.client.retrieve(CONTENT_UNITS_COLLECTION, {
      ids: [qdrantId],
      with_vector: true,
    });

    if (!points.length || !points[0].vector) {
      this.logger.warn(`Vector not found for qdrantId: ${qdrantId}`);
      return [];
    }

    const vector = points[0].vector as number[];

    // Поиск похожих
    const results = await this.client.search(CONTENT_UNITS_COLLECTION, {
      vector,
      limit: options.limit || 5,
      score_threshold: options.minScore || 0.85,
      with_payload: true,
    });

    // Фильтруем сам себя и мапим результат
    return results
      .filter((r) => r.id !== qdrantId)
      .map((r) => ({
        unitId: (r.payload?.unit_id as string) || '',
        topicId: (r.payload?.topic_id as string) || '',
        qdrantId: r.id as string, // ADD: return qdrantId
        score: r.score,
      }));
  }

  /**
   * Поиск похожих Topics по вектору
   */
  async searchSimilarTopics(
    vector: number[],
    options: { limit?: number; minScore?: number },
  ): Promise<Array<{ topicId: string; qdrantId: string; score: number }>> {
    const results = await this.client.search(TOPIC_COLLECTION, {
      vector,
      limit: options.limit || 5,
      score_threshold: options.minScore || 0.85,
      with_payload: true,
    });

    return results.map((r) => ({
      topicId: (r.payload?.topic_id as string) || '',
      qdrantId: r.id as string,
      score: r.score,
    }));
  }

  /**
   * Получить вектор по Qdrant ID
   */
  async getVectorByQdrantId(
    collectionName: string,
    qdrantId: string,
  ): Promise<number[]> {
    const points = await this.client.retrieve(collectionName, {
      ids: [qdrantId],
      with_vector: true,
    });

    if (!points.length || !points[0].vector) {
      throw new Error(`Vector not found for qdrantId: ${qdrantId}`);
    }

    return points[0].vector as number[];
  }

  /**
   * Обновить payload (например, добавить topic_id) для существующего вектора
   */
  async updateUnitPayload(
    qdrantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.client.setPayload(CONTENT_UNITS_COLLECTION, {
      points: [qdrantId],
      payload,
    });
  }
}
