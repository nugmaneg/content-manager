import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AiProducer } from '../ai.producer';
import { QUEUE_AI_PROCESSING, JOBS_AI } from '@queue-contracts/ai';

describe('AiProducer - Three-Stage Architecture', () => {
  let producer: AiProducer;
  let mockQueue: any;
  let mockEvents: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      opts: {
        connection: {},
        prefix: 'test',
      },
    };

    mockEvents = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProducer,
        {
          provide: getQueueToken(QUEUE_AI_PROCESSING),
          useValue: mockQueue,
        },
      ],
    }).compile();

    producer = module.get<AiProducer>(AiProducer);
    (producer as any).events = mockEvents;
  });

  describe('segmentContent', () => {
    it('should add segmentContent job to queue', async () => {
      const mockJob = {
        waitUntilFinished: jest.fn().mockResolvedValue({
          units: [
            {
              unitIndex: 0,
              originalText: 'Test unit',
              contentType: 'news',
              qualityScore: 85,
              qualityReasoning: 'Good quality',
              language: 'en',
            },
          ],
        }),
      };

      mockQueue.add.mockResolvedValue(mockJob);

      const payload = {
        rawContentId: 'raw-1',
        input: {
          text: 'Test content',
          source: { platform: 'telegram' as const },
        },
        provider: 'xai',
      };

      const result = await producer.segmentContent(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOBS_AI.segmentContent,
        payload,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );

      expect(result.units).toHaveLength(1);
      expect(result.units[0].contentType).toBe('news');
    });
  });

  describe('analyzeContentUnit', () => {
    it('should add analyzeContentUnit job to queue', async () => {
      const mockJob = {
        waitUntilFinished: jest.fn().mockResolvedValue({
          unitIndex: 0,
          qualityScore: 90,
          qualityReasoning: 'Excellent',
          originalText: 'Test unit',
          contentType: 'analysis',
          categories: [],
          summary: 'Unit summary',
          sentiment: { label: 'positive', score: 0.8 },
          keywords: ['test', 'analysis'],
          language: 'en',
          needsFactCheck: true,
          factCheckHint: {
            reason: 'Contains claims',
            targets: [
              {
                claim: 'Test claim',
                queries: ['test query 1', 'test query 2'],
                importance: 'high',
              },
            ],
          },
        }),
      };

      mockQueue.add.mockResolvedValue(mockJob);

      const payload = {
        unitId: 'unit-1',
        unit: {
          unitIndex: 0,
          originalText: 'Test unit',
          contentType: 'analysis' as const,
          qualityScore: 90,
          qualityReasoning: 'Excellent',
          language: 'en',
        },
        provider: 'xai',
      };

      const result = await producer.analyzeContentUnit(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOBS_AI.analyzeContentUnit,
        payload,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );

      expect(result.summary).toBe('Unit summary');
      expect(result.needsFactCheck).toBe(true);
      expect(result.factCheckHint?.targets).toHaveLength(1);
    });
  });

  describe('factCheckContent', () => {
    it('should add factCheckContent job to queue', async () => {
      const mockJob = {
        waitUntilFinished: jest.fn().mockResolvedValue({
          units: [
            {
              unitIndex: 0,
              qualityScore: 90,
              qualityReasoning: 'Good',
              originalText: 'Test content',
              contentType: 'news',
              categories: [],
              summary: 'Summary',
              sentiment: { label: 'neutral', score: 0.5 },
              keywords: ['test'],
              language: 'en',
              needsFactCheck: true,
              factCheckResult: {
                verdict: 'verified',
                score: 0.9,
                explanation: 'Facts verified',
                claims: [],
                searchPerformed: true,
              },
            },
          ],
          totalCost: 0.01,
          totalDurationMs: 8000,
        }),
      };

      mockQueue.add.mockResolvedValue(mockJob);

      const payload = {
        units: [
          {
            unitIndex: 0,
            qualityScore: 90,
            qualityReasoning: 'Good',
            originalText: 'Test content',
            contentType: 'news' as const,
            categories: [],
            summary: 'Summary',
            sentiment: { label: 'neutral' as const, score: 0.5 },
            keywords: ['test'],
            language: 'en',
            needsFactCheck: true,
            factCheckHint: {
              reason: 'Contains claims',
              targets: [
                {
                  claim: 'Test claim',
                  queries: ['test query'],
                  importance: 'high' as const,
                },
              ],
            },
          },
        ],
        provider: 'xai',
      };

      const result = await producer.factCheckContent(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOBS_AI.factCheckContent,
        payload,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );

      expect(result.units).toHaveLength(1);
      expect(result.units[0].factCheckResult?.verdict).toBe('verified');
      expect(result.totalCost).toBe(0.01);
    });
  });
});
