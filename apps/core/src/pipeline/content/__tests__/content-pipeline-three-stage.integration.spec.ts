import { Test, TestingModule } from '@nestjs/testing';
import { ContentPipelineProcessor } from '../content-pipeline.processor';
import { DatabaseGrpcClient } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { VectorizationService } from '../services/vectorization.service';
import { TopicMatchingService } from '../services/topic-matching.service';

describe('ContentPipelineProcessor - Three-Stage Architecture', () => {
  let processor: ContentPipelineProcessor;
  let dbClient: jest.Mocked<DatabaseGrpcClient>;
  let aiProducer: jest.Mocked<AiProducer>;
  let vectorizationService: jest.Mocked<VectorizationService>;
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
    vectorizationService = module.get(VectorizationService) as jest.Mocked<VectorizationService>;
    topicMatchingService = module.get(TopicMatchingService) as jest.Mocked<TopicMatchingService>;
  });

  describe('STAGE 1: Segmentation', () => {
    it('should segment RawContent into ContentUnits', async () => {
      const rawContentId = 'test-raw-content-1';

      dbClient.getRawContent.mockResolvedValue({
        id: rawContentId,
        text: 'Test content for segmentation',
        external_id: 'channel123:456',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
        status: 'PENDING',
        received_at: new Date().toISOString(),
        processed_at: "",
        created_at: new Date().toISOString(),
      });

      aiProducer.segmentContent.mockResolvedValue({
        units: [
          {
            unitIndex: 0,
            originalText: 'First unit',
            contentType: 'news',
            qualityScore: 85,
            qualityReasoning: 'High quality news',
            language: 'en',
          },
        ],
      });

      dbClient.createContentUnit.mockResolvedValue({
        id: 'unit-1',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'First unit',
        content_type: 'news',
        quality_score: 85,
        quality_reasoning: 'High quality news',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: false,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Mock STAGE 2
      aiProducer.analyzeContentUnit.mockResolvedValue({
        unitIndex: 0,
        qualityScore: 85,
        qualityReasoning: 'High quality news',
        originalText: 'First unit',
        contentType: 'news',
        categories: [],
        summary: 'Unit summary',
        sentiment: 'neutral',
        keywords: ['test'],
        language: 'en',
        needsFactCheck: false,
      });

      dbClient.updateContentUnitAnalysis.mockResolvedValue({
        id: 'unit-1',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'First unit',
        content_type: 'news',
        quality_score: 85,
        quality_reasoning: 'High quality news',
        language: 'en',
        summary: 'Unit summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["test"]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: false,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Mock vectorization
      aiProducer.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      dbClient.upsertContentUnitVector.mockResolvedValue({
        qdrant_id: 'qdrant-1',
        success: true,
      });

      dbClient.updateContentUnitVector.mockResolvedValue({
        id: 'unit-1',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'First unit',
        content_type: 'news',
        quality_score: 85,
        quality_reasoning: 'High quality news',
        language: 'en',
        summary: 'Unit summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["test"]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: false,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: 'qdrant-1',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Mock topic matching
      topicMatchingService.assignUnitsToTopics.mockResolvedValue([
        {
          unitId: 'unit-1',
          topicId: 'topic-1',
          action: 'added_to_existing',
          needsFactCheck: false,
        },
      ]);

      dbClient.updateRawContentStatus.mockResolvedValue({
        id: rawContentId,
        text: 'Test content for segmentation',
        external_id: 'channel123:456',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
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
      expect(result.unitsCreated).toBe(1);
      expect(aiProducer.segmentContent).toHaveBeenCalledTimes(1);
      expect(dbClient.createContentUnit).toHaveBeenCalledTimes(1);
      expect(aiProducer.analyzeContentUnit).toHaveBeenCalledTimes(1);
    });
  });

  describe('STAGE 2: Parallel Processing', () => {
    it('should process multiple units in parallel', async () => {
      const rawContentId = 'test-raw-content-parallel';

      dbClient.getRawContent.mockResolvedValue({
        id: rawContentId,
        text: 'Multi-unit content',
        external_id: 'channel123:789',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
        status: 'PENDING',
        received_at: new Date().toISOString(),
        processed_at: "",
        created_at: new Date().toISOString(),
      });

      // Stage 1: Segmentation returns 5 units
      aiProducer.segmentContent.mockResolvedValue({
        units: [
          {
            unitIndex: 0,
            originalText: 'Unit 1',
            contentType: 'news',
            qualityScore: 90,
            qualityReasoning: 'High quality',
            language: 'en',
          },
          {
            unitIndex: 1,
            originalText: 'Unit 2',
            contentType: 'analysis',
            qualityScore: 85,
            qualityReasoning: 'Good',
            language: 'en',
          },
          {
            unitIndex: 2,
            originalText: 'Unit 3',
            contentType: 'news',
            qualityScore: 88,
            qualityReasoning: 'Good',
            language: 'en',
          },
          {
            unitIndex: 3,
            originalText: 'Unit 4',
            contentType: 'opinion',
            qualityScore: 75,
            qualityReasoning: 'Medium',
            language: 'en',
          },
          {
            unitIndex: 4,
            originalText: 'Unit 5',
            contentType: 'other',
            qualityScore: 60,
            qualityReasoning: 'Low',
            language: 'en',
          },
        ],
      });

      // Mock createContentUnit for all 5 units
      dbClient.createContentUnit.mockImplementation((data) => {
        return Promise.resolve({
          id: `unit-${data.unit_index}`,
          raw_content_id: rawContentId,
          unit_index: data.unit_index,
          original_text: data.original_text,
          content_type: data.content_type,
          quality_score: data.quality_score,
          quality_reasoning: data.quality_reasoning,
          language: data.language,
          summary: '',
          sentiment: '',
          keywords_json: '[]',
          categories_json: '[]',
          entities_json: "",
          linked_media_indexes_json: "",
          needs_fact_check: false,
          fact_check_hint_json: "",
          fact_check_result_json: "",
          qdrant_id: '',
          embedding_model: '',
          topic_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Mock analyzeContentUnit - track call order AND timing
      const analyzeCallOrder: number[] = [];
      const analyzeStartTimes: number[] = [];
      const analyzeEndTimes: number[] = [];
      const MOCK_DELAY_MS = 100; // Simulate AI processing delay

      aiProducer.analyzeContentUnit.mockImplementation((payload) => {
        const startTime = Date.now();
        analyzeStartTimes.push(startTime);
        analyzeCallOrder.push(payload.unit.unitIndex);

        // Simulate async AI processing with delay
        return new Promise((resolve) => {
          setTimeout(() => {
            analyzeEndTimes.push(Date.now());
            resolve({
              unitIndex: payload.unit.unitIndex,
              qualityScore: payload.unit.qualityScore,
              qualityReasoning: payload.unit.qualityReasoning,
              originalText: payload.unit.originalText,
              contentType: payload.unit.contentType,
              categories: [],
              summary: `Summary ${payload.unit.unitIndex}`,
              sentiment: 'neutral',
              keywords: [`keyword${payload.unit.unitIndex}`],
              language: payload.unit.language,
              needsFactCheck: false,
            });
          }, MOCK_DELAY_MS);
        });
      });

      // Mock updateContentUnitAnalysis
      dbClient.updateContentUnitAnalysis.mockImplementation((id, data) => {
        return Promise.resolve({
          id,
          raw_content_id: rawContentId,
          unit_index: 0,
          original_text: 'Unit',
          content_type: 'news',
          quality_score: 90,
          quality_reasoning: 'Good',
          language: 'en',
          summary: data.summary || '',
          sentiment: data.sentiment ? JSON.stringify(data.sentiment) : '',
          keywords_json: data.keywords ? JSON.stringify(data.keywords) : '[]',
          categories_json: '[]',
          entities_json: '',
          linked_media_indexes_json: '',
          needs_fact_check: false,
          fact_check_hint_json: '',
          fact_check_result_json: '',
          qdrant_id: '',
          embedding_model: '',
          topic_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Mock vectorization
      aiProducer.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      dbClient.upsertContentUnitVector.mockResolvedValue({
        qdrant_id: 'qdrant-test',
        success: true,
      });

      dbClient.updateContentUnitVector.mockImplementation((id) => {
        return Promise.resolve({
          id,
          raw_content_id: rawContentId,
          unit_index: 0,
          original_text: 'Unit',
          content_type: 'news',
          quality_score: 90,
          quality_reasoning: 'Good',
          language: 'en',
          summary: 'Summary',
          sentiment: '{}',
          keywords_json: '[]',
          categories_json: '[]',
          entities_json: '',
          linked_media_indexes_json: '',
          needs_fact_check: false,
          fact_check_hint_json: '',
          fact_check_result_json: '',
          qdrant_id: 'qdrant-test',
          embedding_model: 'text-embedding-3-small',
          topic_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Mock topic matching
      topicMatchingService.assignUnitsToTopics.mockResolvedValue([
        { unitId: 'unit-0', topicId: 'topic-1', action: 'added_to_existing', needsFactCheck: false },
        { unitId: 'unit-1', topicId: 'topic-1', action: 'added_to_existing', needsFactCheck: false },
        { unitId: 'unit-2', topicId: 'topic-1', action: 'added_to_existing', needsFactCheck: false },
        { unitId: 'unit-3', topicId: 'topic-1', action: 'added_to_existing', needsFactCheck: false },
        { unitId: 'unit-4', topicId: 'topic-1', action: 'added_to_existing', needsFactCheck: false },
      ]);

      dbClient.updateRawContentStatus.mockResolvedValue({
        id: rawContentId,
        text: 'Multi-unit content',
        external_id: 'channel123:789',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
        status: 'COMPLETED',
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      const startTime = Date.now();
      const result = await processor.process({
        id: 'job-parallel',
        name: 'processRawContent',
        data: {
          rawContentId,
          options: {},
        },
      } as any);
      const totalDurationMs = Date.now() - startTime;

      // Verify all units were analyzed
      expect(aiProducer.analyzeContentUnit).toHaveBeenCalledTimes(5);
      expect(result.unitsCreated).toBe(5);

      // Verify parallel execution - all calls should be initiated quickly
      expect(analyzeCallOrder).toHaveLength(5);
      expect(analyzeStartTimes).toHaveLength(5);
      expect(analyzeEndTimes).toHaveLength(5);

      // CRITICAL TEST: Verify parallel execution timing
      // All 5 calls should start within a short time window (< 50ms)
      // indicating they were initiated in parallel, not sequentially
      const firstStartTime = Math.min(...analyzeStartTimes);
      const lastStartTime = Math.max(...analyzeStartTimes);
      const startTimeSpread = lastStartTime - firstStartTime;

      expect(startTimeSpread).toBeLessThan(50); // All should start within 50ms

      // Total duration should be close to single call duration (MOCK_DELAY_MS)
      // not 5x the duration (which would indicate sequential execution)
      // Allow some overhead for Promise.all coordination
      const maxExpectedDuration = MOCK_DELAY_MS * 1.5; // 150ms max
      const minSequentialDuration = MOCK_DELAY_MS * 4; // 400ms if sequential

      expect(totalDurationMs).toBeLessThan(minSequentialDuration);

      console.log(`✅ Parallel processing verification:`);
      console.log(`   - Start time spread: ${startTimeSpread}ms (should be < 50ms)`);
      console.log(`   - Total duration: ${totalDurationMs}ms (should be < ${minSequentialDuration}ms)`);
      console.log(`   - Sequential would take: ~${MOCK_DELAY_MS * 5}ms`);
    });
  });

  describe('STAGE 3: Fact-Checking', () => {
    it('should skip fact-checking when units join existing topics', async () => {
      const rawContentId = 'test-raw-content-2';

      dbClient.getRawContent.mockResolvedValue({
        id: rawContentId,
        text: 'Test content',
        external_id: 'channel123:456',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
        status: 'PENDING',
        received_at: new Date().toISOString(),
        processed_at: "",
        created_at: new Date().toISOString(),
      });

      aiProducer.segmentContent.mockResolvedValue({
        units: [
          {
            unitIndex: 0,
            originalText: 'Unit text',
            contentType: 'news',
            qualityScore: 90,
            qualityReasoning: 'Good',
            language: 'en',
          },
        ],
      });

      dbClient.createContentUnit.mockResolvedValue({
        id: 'unit-2',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'Unit text',
        content_type: 'news',
        quality_score: 90,
        quality_reasoning: 'Good',
        language: 'en',
        summary: '',
        sentiment: '',
        keywords_json: '[]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: true,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      aiProducer.analyzeContentUnit.mockResolvedValue({
        unitIndex: 0,
        qualityScore: 90,
        qualityReasoning: 'Good',
        originalText: 'Unit text',
        contentType: 'news',
        categories: [],
        summary: 'Summary',
        sentiment: 'neutral',
        keywords: ['test'],
        language: 'en',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Contains claims',
          targets: [{ claim: 'Test claim', queries: ['test query'], importance: 'high' }],
        },
      });

      dbClient.updateContentUnitAnalysis.mockResolvedValue({
        id: 'unit-2',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'Unit text',
        content_type: 'news',
        quality_score: 90,
        quality_reasoning: 'Good',
        language: 'en',
        summary: 'Summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["test"]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: true,
        fact_check_hint_json: '{"reason":"Contains claims","targets":[{"claim":"Test claim","queries":["test query"],"importance":"high"}]}',
        fact_check_result_json: "",
        qdrant_id: '',
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      aiProducer.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      dbClient.upsertContentUnitVector.mockResolvedValue({
        qdrant_id: 'qdrant-2',
        success: true,
      });

      dbClient.updateContentUnitVector.mockResolvedValue({
        id: 'unit-2',
        raw_content_id: rawContentId,
        unit_index: 0,
        original_text: 'Unit text',
        content_type: 'news',
        quality_score: 90,
        quality_reasoning: 'Good',
        language: 'en',
        summary: 'Summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["test"]',
        categories_json: '[]',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: true,
        fact_check_hint_json: '{"reason":"Contains claims","targets":[{"claim":"Test claim","queries":["test query"],"importance":"high"}]}',
        fact_check_result_json: "",
        qdrant_id: 'qdrant-2',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Unit joins EXISTING topic → no fact-check needed
      topicMatchingService.assignUnitsToTopics.mockResolvedValue([
        {
          unitId: 'unit-2',
          topicId: 'existing-topic-1',
          action: 'added_to_existing',
          needsFactCheck: false,
        },
      ]);

      dbClient.updateRawContentStatus.mockResolvedValue({
        id: rawContentId,
        text: 'Test content',
        external_id: 'channel123:456',
        source_id: 'source-1',
        media_json: "",
        urls_json: "",
        source_meta_json: "",
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
      expect(result.unitsCreated).toBe(1);

      // Fact-checking should NOT be called (unit joined existing topic)
      expect(aiProducer.factCheckContent).not.toHaveBeenCalled();
    });
  });
});
