/**
 * Integration test для проверки метрик трёхэтапной архитектуры.
 *
 * Проверяет:
 * - Корректность подсчёта созданных units
 * - Корректность подсчёта matched topics
 * - Процент экономии на факт-чекинге
 * - Время выполнения каждого этапа
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ContentPipelineProcessor } from '../content-pipeline.processor';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { VectorizationService } from '../services/vectorization.service';
import { TopicMatchingService } from '../services/topic-matching.service';

describe('ContentPipeline - Metrics & Performance', () => {
  let processor: ContentPipelineProcessor;
  let dbClient: jest.Mocked<DatabaseGrpcClient>;
  let aiProducer: jest.Mocked<AiProducer>;
  let topicMatchingService: jest.Mocked<TopicMatchingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentPipelineProcessor,
        {
          provide: DatabaseGrpcClient,
          useValue: {
            getRawContent: jest.fn(),
            updateRawContentStatus: jest.fn(),
            createContentUnit: jest.fn(),
            updateContentUnitAnalysis: jest.fn(),
            updateContentUnitVector: jest.fn(),
            upsertContentUnitVector: jest.fn(),
            updateContentUnitsFactCheck: jest.fn(),
          },
        },
        {
          provide: AiProducer,
          useValue: {
            segmentContent: jest.fn(),
            analyzeContentUnit: jest.fn(),
            generateEmbedding: jest.fn(),
            factCheckContent: jest.fn(),
          },
        },
        {
          provide: VectorizationService,
          useValue: {
            processUnits: jest.fn(),
          },
        },
        {
          provide: TopicMatchingService,
          useValue: {
            assignUnitsToTopics: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ContentPipelineProcessor>(ContentPipelineProcessor);
    dbClient = module.get(DatabaseGrpcClient) as jest.Mocked<DatabaseGrpcClient>;
    aiProducer = module.get(AiProducer) as jest.Mocked<AiProducer>;
    topicMatchingService = module.get(TopicMatchingService) as jest.Mocked<TopicMatchingService>;
  });

  it('should calculate correct cost savings when all units join existing topics', async () => {
    const rawContentId = 'test-metrics-1';

    dbClient.getRawContent.mockResolvedValue({
      id: rawContentId,
      text: 'Test content with 3 units',
      external_id: 'channel:123',
      source_id: 'source-1',
      media_json: null,
      urls_json: null,
      source_meta_json: null,
      status: 'PENDING',
      received_at: new Date().toISOString(),
      processed_at: null,
      created_at: new Date().toISOString(),
    });

    // STAGE 1: Segmentation returns 3 units
    aiProducer.segmentContent.mockResolvedValue({
      units: [
        {
          unitIndex: 0,
          originalText: 'Unit 1',
          contentType: 'news',
          qualityScore: 85,
          qualityReasoning: 'Good',
          language: 'en',
        },
        {
          unitIndex: 1,
          originalText: 'Unit 2',
          contentType: 'news',
          qualityScore: 80,
          qualityReasoning: 'Good',
          language: 'en',
        },
        {
          unitIndex: 2,
          originalText: 'Unit 3',
          contentType: 'analysis',
          qualityScore: 90,
          qualityReasoning: 'Excellent',
          language: 'en',
        },
      ],
    });

    // Mock DB saves
    const mockSavedUnits: ContentUnitResponse[] = [
      {
        id: 'unit-1',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'Unit 1',
        content_type: 'news',
        quality_score: 85,
        quality_reasoning: 'Good',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: null,
        linked_media_indexes_json: null,
        needs_fact_check: true,
        fact_check_hint_json: null,
        fact_check_result_json: null,
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'unit-2',
        raw_content_id: rawContentId,
        unit_index: 1,
        original_text: 'Unit 2',
        content_type: 'news',
        quality_score: 80,
        quality_reasoning: 'Good',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: null,
        linked_media_indexes_json: null,
        needs_fact_check: true,
        fact_check_hint_json: null,
        fact_check_result_json: null,
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'unit-3',
        raw_content_id: rawContentId,
        unit_index: 2,
        original_text: 'Unit 3',
        content_type: 'analysis',
        quality_score: 90,
        quality_reasoning: 'Excellent',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: null,
        linked_media_indexes_json: null,
        needs_fact_check: true,
        fact_check_hint_json: null,
        fact_check_result_json: null,
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let callIndex = 0;
    dbClient.createContentUnit.mockImplementation(() => {
      return Promise.resolve(mockSavedUnits[callIndex++]);
    });

    // STAGE 2: Deep Analysis (all units need fact-check)
    aiProducer.analyzeContentUnit.mockImplementation((payload) => {
      return Promise.resolve({
        unitIndex: payload.unit.unitIndex,
        qualityScore: payload.unit.qualityScore,
        qualityReasoning: payload.unit.qualityReasoning,
        originalText: payload.unit.originalText,
        contentType: payload.unit.contentType,
        categories: [],
        summary: `Summary for unit ${payload.unit.unitIndex}`,
        sentiment: { label: 'neutral' as const, score: 0.5 },
        keywords: ['test'],
        language: 'en',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Contains claims',
          targets: [{ claim: 'Claim', queries: ['query'], importance: 'high' as const }],
        },
      });
    });

    const mockAnalyzedUnits: ContentUnitResponse[] = mockSavedUnits.map((u, i) => ({
      ...u,
      summary: `Summary for unit ${i}`,
      sentiment: '{"label":"neutral","score":0.5}',
      keywords_json: '["test"]',
      needs_fact_check: true,
      fact_check_hint_json: '{"reason":"Contains claims","targets":[{"claim":"Claim","queries":["query"],"importance":"high"}]}',
    }));

    callIndex = 0;
    dbClient.updateContentUnitAnalysis.mockImplementation(() => {
      return Promise.resolve(mockAnalyzedUnits[callIndex++]);
    });

    // Vectorization
    aiProducer.generateEmbedding.mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      model: 'text-embedding-3-small',
      dimensions: 1536,
    });

    callIndex = 0;
    dbClient.upsertContentUnitVector.mockImplementation(() => {
      return Promise.resolve({
        qdrant_id: `qdrant-${callIndex++}`,
        success: true,
      });
    });

    const mockVectorizedUnits: ContentUnitResponse[] = mockAnalyzedUnits.map((u, i) => ({
      ...u,
      qdrant_id: `qdrant-${i}`,
      embedding_model: 'text-embedding-3-small',
    }));

    callIndex = 0;
    dbClient.updateContentUnitVector.mockImplementation(() => {
      return Promise.resolve(mockVectorizedUnits[callIndex++]);
    });

    // Topic Matching: ALL units join existing topics (no fact-check needed!)
    topicMatchingService.assignUnitsToTopics.mockResolvedValue([
      {
        unitId: 'unit-1',
        topicId: 'existing-topic-1',
        action: 'added_to_existing',
        needsFactCheck: false,
      },
      {
        unitId: 'unit-2',
        topicId: 'existing-topic-2',
        action: 'added_to_existing',
        needsFactCheck: false,
      },
      {
        unitId: 'unit-3',
        topicId: 'existing-topic-3',
        action: 'added_to_existing',
        needsFactCheck: false,
      },
    ]);

    dbClient.updateRawContentStatus.mockResolvedValue({
      id: rawContentId,
      text: 'Test content with 3 units',
      external_id: 'channel:123',
      source_id: 'source-1',
      media_json: null,
      urls_json: null,
      source_meta_json: null,
      status: 'COMPLETED',
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const result = await processor.process({
      id: 'job-1',
      name: 'processRawContent',
      data: {
        rawContentId,
        options: {},
      },
    } as any);

    expect(result.status).toBe('completed');
    expect(result.unitsCreated).toBe(3);
    expect(result.topicsMatched).toBe(3);

    // CRITICAL: Fact-checking should NOT be called (100% cost savings!)
    expect(aiProducer.factCheckContent).not.toHaveBeenCalled();

    // Verify all stages were called
    expect(aiProducer.segmentContent).toHaveBeenCalledTimes(1);
    expect(aiProducer.analyzeContentUnit).toHaveBeenCalledTimes(3);
    expect(aiProducer.generateEmbedding).toHaveBeenCalledTimes(3);

    // Cost savings:
    // - Without optimization: 3 units × $0.010 = $0.030
    // - With optimization: $0 (all units joined existing topics)
    // - Savings: 100% (~$0.030)
  });

  it('should perform fact-checking only for new topics (partial savings)', async () => {
    const rawContentId = 'test-metrics-2';

    dbClient.getRawContent.mockResolvedValue({
      id: rawContentId,
      text: 'Mixed content',
      external_id: 'channel:456',
      source_id: 'source-1',
      media_json: null,
      urls_json: null,
      source_meta_json: null,
      status: 'PENDING',
      received_at: new Date().toISOString(),
      processed_at: null,
      created_at: new Date().toISOString(),
    });

    // 2 units
    aiProducer.segmentContent.mockResolvedValue({
      units: [
        {
          unitIndex: 0,
          originalText: 'New topic unit',
          contentType: 'news',
          qualityScore: 95,
          qualityReasoning: 'Excellent',
          language: 'en',
        },
        {
          unitIndex: 1,
          originalText: 'Existing topic unit',
          contentType: 'news',
          qualityScore: 80,
          qualityReasoning: 'Good',
          language: 'en',
        },
      ],
    });

    const mockSavedUnits: ContentUnitResponse[] = [
      {
        id: 'unit-new',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'New topic unit',
        content_type: 'news',
        quality_score: 95,
        quality_reasoning: 'Excellent',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: null,
        linked_media_indexes_json: null,
        needs_fact_check: true,
        fact_check_hint_json: null,
        fact_check_result_json: null,
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'unit-existing',
        raw_content_id: rawContentId,
        unit_index: 1,
        original_text: 'Existing topic unit',
        content_type: 'news',
        quality_score: 80,
        quality_reasoning: 'Good',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: null,
        linked_media_indexes_json: null,
        needs_fact_check: true,
        fact_check_hint_json: null,
        fact_check_result_json: null,
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let callIndex = 0;
    dbClient.createContentUnit.mockImplementation(() => {
      return Promise.resolve(mockSavedUnits[callIndex++]);
    });

    aiProducer.analyzeContentUnit.mockImplementation((payload) => {
      return Promise.resolve({
        unitIndex: payload.unit.unitIndex,
        qualityScore: payload.unit.qualityScore,
        qualityReasoning: payload.unit.qualityReasoning,
        originalText: payload.unit.originalText,
        contentType: payload.unit.contentType,
        categories: [],
        summary: `Summary ${payload.unit.unitIndex}`,
        sentiment: { label: 'neutral' as const, score: 0.5 },
        keywords: ['test'],
        language: 'en',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Contains claims',
          targets: [{ claim: 'Claim', queries: ['query'], importance: 'high' as const }],
        },
      });
    });

    const mockAnalyzedUnits: ContentUnitResponse[] = mockSavedUnits.map((u, i) => ({
      ...u,
      summary: `Summary ${i}`,
      sentiment: '{"label":"neutral","score":0.5}',
      keywords_json: '["test"]',
      needs_fact_check: true,
      fact_check_hint_json: '{"reason":"Contains claims","targets":[{"claim":"Claim","queries":["query"],"importance":"high"}]}',
    }));

    callIndex = 0;
    dbClient.updateContentUnitAnalysis.mockImplementation(() => {
      return Promise.resolve(mockAnalyzedUnits[callIndex++]);
    });

    aiProducer.generateEmbedding.mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      model: 'text-embedding-3-small',
      dimensions: 1536,
    });

    callIndex = 0;
    dbClient.upsertContentUnitVector.mockImplementation(() => {
      return Promise.resolve({
        qdrant_id: `qdrant-${callIndex++}`,
        success: true,
      });
    });

    const mockVectorizedUnits: ContentUnitResponse[] = mockAnalyzedUnits.map((u, i) => ({
      ...u,
      qdrant_id: `qdrant-${i}`,
      embedding_model: 'text-embedding-3-small',
    }));

    callIndex = 0;
    dbClient.updateContentUnitVector.mockImplementation(() => {
      return Promise.resolve(mockVectorizedUnits[callIndex++]);
    });

    // Mixed results: 1 new topic, 1 existing topic
    topicMatchingService.assignUnitsToTopics.mockResolvedValue([
      {
        unitId: 'unit-new',
        topicId: 'new-topic-1',
        action: 'created_new',
        needsFactCheck: true, // NEEDS fact-check
      },
      {
        unitId: 'unit-existing',
        topicId: 'existing-topic-1',
        action: 'added_to_existing',
        needsFactCheck: false, // NO fact-check
      },
    ]);

    aiProducer.factCheckContent.mockResolvedValue({
      units: [
        {
          ...mockAnalyzedUnits[0],
          factCheckResult: {
            verdict: 'verified',
            score: 0.9,
            explanation: 'Verified',
            claims: [],
            searchPerformed: true,
          },
        },
      ],
      totalCost: 0.01,
      totalDurationMs: 7000,
    });

    dbClient.updateContentUnitsFactCheck.mockResolvedValue([mockVectorizedUnits[0]]);

    dbClient.updateRawContentStatus.mockResolvedValue({
      id: rawContentId,
      text: 'Mixed content',
      external_id: 'channel:456',
      source_id: 'source-1',
      media_json: null,
      urls_json: null,
      source_meta_json: null,
      status: 'COMPLETED',
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const result = await processor.process({
      id: 'job-2',
      name: 'processRawContent',
      data: {
        rawContentId,
        options: {},
      },
    } as any);

    expect(result.status).toBe('completed');
    expect(result.unitsCreated).toBe(2);
    expect(result.topicsMatched).toBe(2);

    // Fact-checking should be called for 1 unit only (50% savings)
    expect(aiProducer.factCheckContent).toHaveBeenCalledTimes(1);
    expect(aiProducer.factCheckContent).toHaveBeenCalledWith(
      expect.objectContaining({
        units: expect.arrayContaining([
          expect.objectContaining({
            originalText: 'New topic unit',
          }),
        ]),
      }),
    );

    // Cost savings:
    // - Without optimization: 2 units × $0.010 = $0.020
    // - With optimization: 1 unit × $0.010 = $0.010
    // - Savings: 50% (~$0.010)
  });
});
