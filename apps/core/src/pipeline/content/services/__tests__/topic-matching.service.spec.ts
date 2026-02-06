import { Test, TestingModule } from '@nestjs/testing';
import { TopicMatchingService } from '../topic-matching.service';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../../grpc';

describe('TopicMatchingService - Two-Level Search', () => {
  let service: TopicMatchingService;
  let dbClient: jest.Mocked<DatabaseGrpcClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicMatchingService,
        {
          provide: DatabaseGrpcClient,
          useValue: {
            getVectorByQdrantId: jest.fn(),
            searchSimilarTopics: jest.fn(),
            searchSimilarUnits: jest.fn(),
            createTopic: jest.fn(),
            getTopic: jest.fn(),
            updateTopic: jest.fn(),
            updateContentUnitTopic: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TopicMatchingService>(TopicMatchingService);
    dbClient = module.get(DatabaseGrpcClient) as jest.Mocked<DatabaseGrpcClient>;
  });

  describe('LEVEL 1: Direct Topic Search', () => {
    it('should find similar topic directly and add unit to it', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-1',
        raw_content_id: 'raw-1',
        unit_index: 0,
        quality_score: 90,
        quality_reasoning: 'High quality',
        original_text: 'Bitcoin reaches $100k',
        content_type: 'news',
        categories_json: '[]',
        summary: 'Bitcoin достиг исторического максимума $100k',
        sentiment: '{"label":"positive","score":0.8}',
        keywords_json: '["bitcoin","crypto","$100k"]',
        language: 'ru',
        entities_json: '',
        linked_media_indexes_json: '',
        needs_fact_check: true,
        fact_check_hint_json: '',
        fact_check_result_json: '',
        qdrant_id: 'qdrant-1',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];

      // Mock getVectorByQdrantId to return unit's vector
      dbClient.getVectorByQdrantId.mockResolvedValue(mockVector);

      // Mock searchSimilarTopics to return similar topic
      dbClient.searchSimilarTopics.mockResolvedValue([
        {
          topicId: 'existing-topic-1',
          qdrantId: 'topic-qdrant-1',
          score: 0.92,
        },
      ]);

      dbClient.getTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Bitcoin price movements',
        summary: 'Bitcoin market analysis',
        language: 'ru',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 1,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'verified',
        fact_check_result_json: '',
        fact_checked_at: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(unit);
      dbClient.updateTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Bitcoin price movements',
        summary: 'Bitcoin market analysis',
        language: 'ru',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 2,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'verified',
        fact_check_result_json: '',
        fact_checked_at: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.assignToTopic(unit);

      // Verify LEVEL 1 was used
      expect(dbClient.getVectorByQdrantId).toHaveBeenCalledWith('content_units', 'qdrant-1');
      expect(dbClient.searchSimilarTopics).toHaveBeenCalledWith(mockVector, {
        limit: 3,
        minScore: 0.85,
      });

      // Verify unit was added to existing topic
      expect(result.action).toBe('added_to_existing');
      expect(result.topicId).toBe('existing-topic-1');
      expect(result.needsFactCheck).toBe(false); // No fact-check needed for existing topic

      // Verify LEVEL 2 was NOT called (short-circuited by LEVEL 1)
      expect(dbClient.searchSimilarUnits).not.toHaveBeenCalled();

      // Verify topic version was incremented
      expect(dbClient.updateTopic).toHaveBeenCalledWith('existing-topic-1', { version: 2 });
    });

    it('should fallback to LEVEL 2 if no topics found on LEVEL 1', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-2',
        raw_content_id: 'raw-2',
        unit_index: 0,
        quality_score: 85,
        quality_reasoning: 'Good quality',
        original_text: 'Ethereum update',
        content_type: 'news',
        categories_json: '[]',
        summary: 'Ethereum network upgrade',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["ethereum","upgrade"]',
        language: 'en',
        entities_json: '',
        linked_media_indexes_json: '',
        needs_fact_check: false,
        fact_check_hint_json: '',
        fact_check_result_json: '',
        qdrant_id: 'qdrant-2',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockVector = [0.2, 0.3, 0.4, 0.5, 0.6];

      // LEVEL 1: No similar topics found
      dbClient.getVectorByQdrantId.mockResolvedValue(mockVector);
      dbClient.searchSimilarTopics.mockResolvedValue([]);

      // LEVEL 2: Find similar unit with topic
      dbClient.searchSimilarUnits.mockResolvedValue([
        {
          unit_id: 'similar-unit-1',
          topic_id: 'existing-topic-2',
          score: 0.88,
        },
      ]);

      dbClient.getTopic.mockResolvedValue({
        id: 'existing-topic-2',
        type: 'news',
        title: 'Ethereum developments',
        summary: 'Ethereum ecosystem updates',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-2',
        category_id: '',
        version: 1,
        relevance_score: 0.85,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: '',
        fact_checked_at: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(unit);
      dbClient.updateTopic.mockResolvedValue({
        id: 'existing-topic-2',
        type: 'news',
        title: 'Ethereum developments',
        summary: 'Ethereum ecosystem updates',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-2',
        category_id: '',
        version: 2,
        relevance_score: 0.85,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.assignToTopic(unit);

      // Verify LEVEL 1 was attempted
      expect(dbClient.getVectorByQdrantId).toHaveBeenCalledWith('content_units', 'qdrant-2');
      expect(dbClient.searchSimilarTopics).toHaveBeenCalledWith(mockVector, {
        limit: 3,
        minScore: 0.85,
      });

      // Verify LEVEL 2 was used as fallback
      expect(dbClient.searchSimilarUnits).toHaveBeenCalledWith('qdrant-2', {
        limit: 5,
        minScore: 0.85,
      });

      // Verify unit was added to existing topic
      expect(result.action).toBe('added_to_existing');
      expect(result.topicId).toBe('existing-topic-2');
      expect(result.needsFactCheck).toBe(false);
    });

    it('should create new topic if both LEVEL 1 and LEVEL 2 find nothing', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-3',
        raw_content_id: 'raw-3',
        unit_index: 0,
        quality_score: 95,
        quality_reasoning: 'Excellent quality',
        original_text: 'New blockchain technology',
        content_type: 'analysis',
        categories_json: '[]',
        summary: 'Revolutionary blockchain innovation',
        sentiment: '{"label":"positive","score":0.9}',
        keywords_json: '["blockchain","innovation"]',
        language: 'en',
        entities_json: '',
        linked_media_indexes_json: '',
        needs_fact_check: true,
        fact_check_hint_json: '{"reason":"Contains claims","targets":[]}',
        fact_check_result_json: '',
        qdrant_id: 'qdrant-3',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockVector = [0.3, 0.4, 0.5, 0.6, 0.7];

      // LEVEL 1: No similar topics
      dbClient.getVectorByQdrantId.mockResolvedValue(mockVector);
      dbClient.searchSimilarTopics.mockResolvedValue([]);

      // LEVEL 2: No similar units
      dbClient.searchSimilarUnits.mockResolvedValue([]);

      // Create new topic
      dbClient.createTopic.mockResolvedValue({
        id: 'new-topic-1',
        type: 'analysis',
        title: 'Revolutionary blockchain innovation',
        summary: 'Revolutionary blockchain innovation',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'qdrant-3',
        category_id: '',
        version: 1,
        relevance_score: 0,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(unit);

      const result = await service.assignToTopic(unit);

      // Verify both levels were attempted
      expect(dbClient.getVectorByQdrantId).toHaveBeenCalled();
      expect(dbClient.searchSimilarTopics).toHaveBeenCalled();
      expect(dbClient.searchSimilarUnits).toHaveBeenCalled();

      // Verify new topic was created
      expect(result.action).toBe('created_new');
      expect(result.topicId).toBe('new-topic-1');
      expect(result.needsFactCheck).toBe(true); // Fact-check needed for new topic

      expect(dbClient.createTopic).toHaveBeenCalledWith({
        type: 'analysis',
        title: 'Revolutionary blockchain innovation',
        summary: 'Revolutionary blockchain innovation',
        language: 'en',
        embeddingModel: 'text-embedding-3-small',
        qdrantId: 'qdrant-3',
      });
    });
  });

  describe('LEVEL 2: Search by Units', () => {
    it('should find existing topic through similar units', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-1',
        raw_content_id: 'raw-1',
        unit_index: 0,
        quality_score: 85,
        quality_reasoning: 'Good quality',
        original_text: 'Test content',
        content_type: 'news',
        categories_json: '[]',
        summary: 'Test summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '["test"]',
        language: 'en',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: true,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: 'qdrant-1',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // LEVEL 2: Find similar unit with topic_id
      dbClient.searchSimilarUnits.mockResolvedValue([
        {
          unit_id: 'similar-unit-1',
          topic_id: 'existing-topic-1',
          score: 0.92,
        },
      ]);

      dbClient.getTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Existing Topic',
        summary: 'Topic summary',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 1,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(unit);
      dbClient.updateTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Existing Topic',
        summary: 'Topic summary',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 2,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await service.assignToTopic(unit);

      expect(result.action).toBe('added_to_existing');
      expect(result.topicId).toBe('existing-topic-1');
      expect(result.needsFactCheck).toBe(false);
      expect(dbClient.searchSimilarUnits).toHaveBeenCalledWith('qdrant-1', {
        limit: 5,
        minScore: 0.85,
      });
      expect(dbClient.updateContentUnitTopic).toHaveBeenCalledWith('unit-1', 'existing-topic-1');
      expect(dbClient.updateTopic).toHaveBeenCalledWith('existing-topic-1', { version: 2 });
    });

    it('should create new topic when no similar units found', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-2',
        raw_content_id: 'raw-2',
        unit_index: 0,
        quality_score: 90,
        quality_reasoning: 'High quality',
        original_text: 'New unique content',
        content_type: 'analysis',
        categories_json: '[]',
        summary: 'New unique summary',
        sentiment: '{"label":"positive","score":0.8}',
        keywords_json: '["unique","new"]',
        language: 'en',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: true,
        fact_check_hint_json: '{"reason":"Contains claims","targets":[]}',
        fact_check_result_json: "",
        qdrant_id: 'qdrant-2',
        embedding_model: 'text-embedding-3-small',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // No similar units found
      dbClient.searchSimilarUnits.mockResolvedValue([]);

      dbClient.createTopic.mockResolvedValue({
        id: 'new-topic-1',
        type: 'analysis',
        title: 'New unique summary',
        summary: 'New unique summary',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'qdrant-2',
        category_id: '',
        version: 1,
        relevance_score: 0,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(unit);

      const result = await service.assignToTopic(unit);

      expect(result.action).toBe('created_new');
      expect(result.topicId).toBe('new-topic-1');
      expect(result.needsFactCheck).toBe(true);
      expect(dbClient.createTopic).toHaveBeenCalledWith({
        type: 'analysis',
        title: 'New unique summary',
        summary: 'New unique summary',
        language: 'en',
        embeddingModel: 'text-embedding-3-small',
        qdrantId: 'qdrant-2',
      });
      expect(dbClient.updateContentUnitTopic).toHaveBeenCalledWith('unit-2', 'new-topic-1');
    });

    it('should skip units without qdrant_id', async () => {
      const unit: ContentUnitResponse = {
        id: 'unit-3',
        raw_content_id: 'raw-3',
        unit_index: 0,
        quality_score: 75,
        quality_reasoning: 'Medium quality',
        original_text: 'Content without vector',
        content_type: 'other',
        categories_json: '[]',
        summary: 'Summary',
        sentiment: '{"label":"neutral","score":0.5}',
        keywords_json: '[]',
        language: 'en',
        entities_json: "",
        linked_media_indexes_json: "",
        needs_fact_check: false,
        fact_check_hint_json: "",
        fact_check_result_json: "",
        qdrant_id: '', // NO VECTOR
        embedding_model: '',
        topic_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await service.assignToTopic(unit);

      expect(result.action).toBe('skipped');
      expect(result.reason).toBe('Unit not vectorized');
      expect(result.needsFactCheck).toBe(false);
      expect(dbClient.searchSimilarUnits).not.toHaveBeenCalled();
      expect(dbClient.createTopic).not.toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple units and return statistics', async () => {
      const units: ContentUnitResponse[] = [
        {
          id: 'unit-1',
          raw_content_id: 'raw-1',
          unit_index: 0,
          quality_score: 85,
          quality_reasoning: 'Good',
          original_text: 'Unit 1',
          content_type: 'news',
          categories_json: '[]',
          summary: 'Summary 1',
          sentiment: '{"label":"neutral","score":0.5}',
          keywords_json: '[]',
          language: 'en',
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
        },
        {
          id: 'unit-2',
          raw_content_id: 'raw-1',
          unit_index: 1,
          quality_score: 90,
          quality_reasoning: 'Excellent',
          original_text: 'Unit 2',
          content_type: 'news',
          categories_json: '[]',
          summary: 'Summary 2',
          sentiment: '{"label":"positive","score":0.8}',
          keywords_json: '[]',
          language: 'en',
          entities_json: "",
          linked_media_indexes_json: "",
          needs_fact_check: true,
          fact_check_hint_json: "",
          fact_check_result_json: "",
          qdrant_id: '', // No vector - will be skipped
          embedding_model: '',
          topic_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // First unit: find existing topic
      dbClient.searchSimilarUnits.mockResolvedValueOnce([
        { unit_id: 'similar-1', topic_id: 'existing-topic-1', score: 0.9 },
      ]);

      dbClient.getTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Topic',
        summary: 'Summary',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 1,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      dbClient.updateContentUnitTopic.mockResolvedValue(units[0]);
      dbClient.updateTopic.mockResolvedValue({
        id: 'existing-topic-1',
        type: 'news',
        title: 'Topic',
        summary: 'Summary',
        language: 'en',
        embedding_model: 'text-embedding-3-small',
        qdrant_id: 'topic-qdrant-1',
        category_id: '',
        version: 2,
        relevance_score: 0.9,
        is_expired: false,
        fact_check_status: 'pending',
        fact_check_result_json: "",
        fact_checked_at: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const results = await service.assignUnitsToTopics(units);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('added_to_existing');
      expect(results[1].action).toBe('skipped');
      expect(results[1].reason).toBe('Unit not vectorized');
    });
  });
});
