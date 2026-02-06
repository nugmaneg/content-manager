import { Test, TestingModule } from '@nestjs/testing';
import { AiProcessor } from '../ai.processor';
import { AnalysisOrchestratorService } from '../../orchestrator/analysis-orchestrator.service';
import { JOBS_AI } from '@queue-contracts/ai';
import {
  SegmentContentPayload,
  AnalyzeContentUnitPayload,
  FactCheckContentPayload,
  GenerateTextPayload,
  GenerateEmbeddingPayload,
} from '@queue-contracts/ai';

describe('AiProcessor - Three-Stage Architecture', () => {
  let processor: AiProcessor;
  let mockOrchestrator: jest.Mocked<AnalysisOrchestratorService>;

  beforeEach(async () => {
    mockOrchestrator = {
      segmentContent: jest.fn(),
      analyzeContentUnit: jest.fn(),
      factCheckContent: jest.fn(),
      generateText: jest.fn(),
      generateEmbedding: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProcessor,
        {
          provide: AnalysisOrchestratorService,
          useValue: mockOrchestrator,
        },
      ],
    }).compile();

    processor = module.get<AiProcessor>(AiProcessor);
  });

  describe('handleSegmentContent (STAGE 1)', () => {
    it('should handle segmentContent job', async () => {
      const payload: SegmentContentPayload = {
        rawContentId: 'raw-1',
        input: {
          text: 'Test content',
          source: { platform: 'telegram' },
        },
        provider: 'xai',
      };

      const mockResult = {
        units: [
          {
            unitIndex: 0,
            originalText: 'Test content',
            contentType: 'news' as const,
            qualityScore: 85,
            qualityReasoning: 'Good quality',
            language: 'en',
          },
        ],
      };

      mockOrchestrator.segmentContent.mockResolvedValue(mockResult);

      const job = {
        id: 'job-1',
        name: JOBS_AI.segmentContent,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(mockOrchestrator.segmentContent).toHaveBeenCalledWith(
        payload.input,
        'xai',
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('should use default provider if not specified', async () => {
      const payload: SegmentContentPayload = {
        rawContentId: 'raw-1',
        input: {
          text: 'Test',
          source: { platform: 'telegram' },
        },
      };

      mockOrchestrator.segmentContent.mockResolvedValue({ units: [] });

      const job = {
        id: 'job-1',
        name: JOBS_AI.segmentContent,
        data: payload,
      } as any;

      await processor.process(job);

      expect(mockOrchestrator.segmentContent).toHaveBeenCalledWith(
        payload.input,
        'xai',
        undefined,
      );
    });
  });

  describe('handleAnalyzeContentUnit (STAGE 2)', () => {
    it('should handle analyzeContentUnit job', async () => {
      const payload: AnalyzeContentUnitPayload = {
        unitId: 'unit-1',
        unit: {
          unitIndex: 0,
          originalText: 'Bitcoin достиг $100k',
          contentType: 'news',
          qualityScore: 90,
          qualityReasoning: 'Important news',
          language: 'ru',
        },
        provider: 'xai',
      };

      const mockResult = {
        unitIndex: 0,
        qualityScore: 90,
        qualityReasoning: 'Important news',
        originalText: 'Bitcoin достиг $100k',
        contentType: 'news' as const,
        categories: [],
        summary: 'Bitcoin news',
        sentiment: { label: 'positive' as const, score: 0.8 },
        keywords: ['Bitcoin'],
        language: 'ru',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Price data',
          targets: [
            {
              claim: 'Bitcoin $100k',
              queries: ['Bitcoin price today'],
              importance: 'high' as const,
            },
          ],
        },
      };

      mockOrchestrator.analyzeContentUnit.mockResolvedValue(mockResult);

      const job = {
        id: 'job-2',
        name: JOBS_AI.analyzeContentUnit,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(mockOrchestrator.analyzeContentUnit).toHaveBeenCalledWith(
        payload.unit,
        'xai',
        undefined,
      );
      expect(result).toEqual(mockResult);
      expect(result.needsFactCheck).toBe(true);
    });

    it('should pass generation options', async () => {
      const payload: AnalyzeContentUnitPayload = {
        unitId: 'unit-1',
        unit: {
          unitIndex: 0,
          originalText: 'Test',
          contentType: 'other',
          qualityScore: 70,
          qualityReasoning: 'OK',
          language: 'en',
        },
        options: { model: 'grok-2-1212' },
      };

      mockOrchestrator.analyzeContentUnit.mockResolvedValue({} as any);

      const job = {
        id: 'job-2',
        name: JOBS_AI.analyzeContentUnit,
        data: payload,
      } as any;

      await processor.process(job);

      expect(mockOrchestrator.analyzeContentUnit).toHaveBeenCalledWith(
        payload.unit,
        'xai',
        { model: 'grok-2-1212' },
      );
    });
  });

  describe('handleFactCheckContent (STAGE 3)', () => {
    it('should handle factCheckContent job', async () => {
      const payload: FactCheckContentPayload = {
        units: [
          {
            unitIndex: 0,
            qualityScore: 90,
            qualityReasoning: 'Good',
            originalText: 'Test claim',
            contentType: 'news',
            categories: [],
            summary: 'Summary',
            sentiment: 'neutral',
            keywords: ['test'],
            language: 'en',
            needsFactCheck: true,
            factCheckHint: {
              reason: 'Contains claim',
              targets: [
                {
                  claim: 'Test claim',
                  queries: ['test query'],
                  importance: 'high',
                },
              ],
            },
          },
        ],
        provider: 'xai',
      };

      const mockResult = {
        units: [
          {
            ...payload.units[0],
            factCheckResult: {
              verdict: 'verified' as const,
              score: 0.9,
              explanation: 'Verified',
              claims: [],
              searchPerformed: true,
            },
          },
        ],
        totalCost: 0.01,
        totalDurationMs: 8000,
      };

      mockOrchestrator.factCheckContent.mockResolvedValue(mockResult);

      const job = {
        id: 'job-3',
        name: JOBS_AI.factCheckContent,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(mockOrchestrator.factCheckContent).toHaveBeenCalledWith(
        payload.units,
        'xai',
        undefined,
      );
      expect(result).toEqual(mockResult);
      expect(result.units[0].factCheckResult?.verdict).toBe('verified');
    });

    it('should handle multiple units for fact-checking', async () => {
      const payload: FactCheckContentPayload = {
        units: [
          {
            unitIndex: 0,
            qualityScore: 90,
            qualityReasoning: 'Good',
            originalText: 'Claim 1',
            contentType: 'news',
            categories: [],
            summary: 'Summary 1',
            sentiment: 'neutral',
            keywords: [],
            language: 'en',
            needsFactCheck: true,
          },
          {
            unitIndex: 1,
            qualityScore: 85,
            qualityReasoning: 'Good',
            originalText: 'Claim 2',
            contentType: 'analysis',
            categories: [],
            summary: 'Summary 2',
            sentiment: 'positive',
            keywords: [],
            language: 'en',
            needsFactCheck: true,
          },
        ],
      };

      const mockResult = {
        units: payload.units.map((u) => ({
          ...u,
          factCheckResult: {
            verdict: 'verified' as const,
            score: 0.9,
            explanation: 'OK',
            claims: [],
            searchPerformed: true,
          },
        })),
        totalCost: 0.02,
        totalDurationMs: 16000,
      };

      mockOrchestrator.factCheckContent.mockResolvedValue(mockResult);

      const job = {
        id: 'job-3',
        name: JOBS_AI.factCheckContent,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(result.units).toHaveLength(2);
      expect(result.totalCost).toBe(0.02);
    });
  });

  describe('Legacy handlers (generateText, generateEmbedding)', () => {
    it('should handle generateText job', async () => {
      const payload: GenerateTextPayload = {
        prompt: 'Test prompt',
        provider: 'xai',
      };

      const mockResult = {
        text: 'Generated text',
        model: 'grok-2-latest',
        cost: 0.001,
      };

      mockOrchestrator.generateText.mockResolvedValue(mockResult);

      const job = {
        id: 'job-4',
        name: JOBS_AI.generateText,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(mockOrchestrator.generateText).toHaveBeenCalledWith(
        payload.prompt,
        'xai',
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle generateEmbedding job', async () => {
      const payload: GenerateEmbeddingPayload = {
        text: 'Text to embed',
        provider: 'openai',
      };

      const mockResult = {
        embedding: new Array(1536).fill(0.1),
        model: 'text-embedding-3-small',
        dimensions: 1536,
      };

      mockOrchestrator.generateEmbedding.mockResolvedValue(mockResult);

      const job = {
        id: 'job-5',
        name: JOBS_AI.generateEmbedding,
        data: payload,
      } as any;

      const result = await processor.process(job);

      expect(mockOrchestrator.generateEmbedding).toHaveBeenCalledWith(
        payload.text,
        'openai',
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
