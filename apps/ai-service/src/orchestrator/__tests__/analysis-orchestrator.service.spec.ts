import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisOrchestratorService } from '../analysis-orchestrator.service';
import { AiProviderFactory } from '../../providers/ai-provider.factory';
import {
  ContentInput,
  ContentUnitBasic,
  ContentUnitAnalysis,
  ContentSegmentationResult,
  FactCheckContentResult,
} from '@queue-contracts/ai';

describe('AnalysisOrchestratorService - Three-Stage Architecture', () => {
  let service: AnalysisOrchestratorService;
  let mockProvider: any;
  let mockProviderFactory: any;

  beforeEach(async () => {
    mockProvider = {
      segmentContent: jest.fn(),
      analyzeContentUnit: jest.fn(),
      factCheckUnit: jest.fn(),
    };

    mockProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisOrchestratorService,
        {
          provide: AiProviderFactory,
          useValue: mockProviderFactory,
        },
      ],
    }).compile();

    service = module.get<AnalysisOrchestratorService>(
      AnalysisOrchestratorService,
    );
  });

  describe('segmentContent (STAGE 1)', () => {
    it('should segment content and return units', async () => {
      const input: ContentInput = {
        text: 'Test content for segmentation',
        source: {
          platform: 'telegram',
        },
      };

      const mockResult: ContentSegmentationResult = {
        units: [
          {
            unitIndex: 0,
            originalText: 'Test content for segmentation',
            contentType: 'news',
            qualityScore: 85,
            qualityReasoning: 'High quality content',
            language: 'en',
          },
        ],
      };

      mockProvider.segmentContent.mockResolvedValue({
        result: mockResult,
        meta: {
          model: 'grok-2-latest',
          cost: 0.003,
          durationMs: 4000,
        },
      });

      const result = await service.segmentContent(input, 'xai');

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith('xai');
      expect(mockProvider.segmentContent).toHaveBeenCalledWith(input, undefined);
      expect(result).toEqual(mockResult);
      expect(result.units).toHaveLength(1);
      expect(result.units[0].contentType).toBe('news');
    });

    it('should pass generation options to provider', async () => {
      const input: ContentInput = {
        text: 'Test',
        source: { platform: 'telegram' },
      };

      const options = { model: 'grok-2-1212' };

      mockProvider.segmentContent.mockResolvedValue({
        result: { units: [] },
        meta: {},
      });

      await service.segmentContent(input, 'xai', options);

      expect(mockProvider.segmentContent).toHaveBeenCalledWith(input, options);
    });
  });

  describe('analyzeContentUnit (STAGE 2)', () => {
    it('should analyze content unit and return enriched data', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Bitcoin достиг $100,000',
        contentType: 'news',
        qualityScore: 90,
        qualityReasoning: 'Important financial news',
        language: 'ru',
      };

      const mockResult: ContentUnitAnalysis = {
        unitIndex: 0,
        qualityScore: 90,
        qualityReasoning: 'Important financial news',
        originalText: 'Bitcoin достиг $100,000',
        contentType: 'news',
        categories: [],
        summary: 'Bitcoin достиг исторического максимума',
        sentiment: 'positive',
        keywords: ['Bitcoin', 'криптовалюта', '$100k'],
        language: 'ru',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Содержит ценовые данные',
          targets: [
            {
              claim: 'Bitcoin достиг $100,000',
              queries: ['Bitcoin price USD today', 'BTC 100000 January 2026'],
              importance: 'high',
            },
          ],
        },
      };

      mockProvider.analyzeContentUnit.mockResolvedValue({
        result: mockResult,
        meta: {
          model: 'grok-2-latest',
          cost: 0.002,
          durationMs: 2500,
        },
      });

      const result = await service.analyzeContentUnit(unit, 'xai');

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith('xai');
      expect(mockProvider.analyzeContentUnit).toHaveBeenCalledWith(
        unit,
        undefined,
      );
      expect(result).toEqual(mockResult);
      expect(result.needsFactCheck).toBe(true);
      expect(result.factCheckHint?.targets).toHaveLength(1);
    });

    it('should handle units without fact-check needs', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Simple informational text',
        contentType: 'other',
        qualityScore: 60,
        qualityReasoning: 'Low quality',
        language: 'en',
      };

      const mockResult: ContentUnitAnalysis = {
        ...unit,
        categories: [],
        summary: 'Simple text',
        sentiment: 'neutral',
        keywords: ['simple'],
        needsFactCheck: false,
      };

      mockProvider.analyzeContentUnit.mockResolvedValue({
        result: mockResult,
        meta: {},
      });

      const result = await service.analyzeContentUnit(unit, 'xai');

      expect(result.needsFactCheck).toBe(false);
      expect(result.factCheckHint).toBeUndefined();
    });
  });

  describe('factCheckContent (STAGE 3)', () => {
    it('should fact-check multiple units and return results', async () => {
      const units: ContentUnitAnalysis[] = [
        {
          unitIndex: 0,
          qualityScore: 90,
          qualityReasoning: 'Good',
          originalText: 'Bitcoin достиг $100k',
          contentType: 'news',
          categories: [],
          summary: 'Bitcoin news',
          sentiment: 'positive',
          keywords: ['Bitcoin'],
          language: 'ru',
          needsFactCheck: true,
          factCheckHint: {
            reason: 'Price claim',
            targets: [
              {
                claim: 'Bitcoin $100k',
                queries: ['Bitcoin price today'],
                importance: 'high',
              },
            ],
          },
        },
        {
          unitIndex: 1,
          qualityScore: 85,
          qualityReasoning: 'Good',
          originalText: 'Market analysis',
          contentType: 'analysis',
          categories: [],
          summary: 'Market summary',
          sentiment: 'neutral',
          keywords: ['market'],
          language: 'en',
          needsFactCheck: true,
          factCheckHint: {
            reason: 'Market data',
            targets: [
              {
                claim: 'Market trend',
                queries: ['market trend 2026'],
                importance: 'medium',
              },
            ],
          },
        },
      ];

      const mockFactCheckResult = {
        verdict: 'verified',
        score: 0.9,
        explanation: 'Facts verified',
        claims: [],
        searchPerformed: true,
      };

      mockProvider.factCheckUnit
        .mockResolvedValueOnce({
          result: mockFactCheckResult,
          meta: { cost: 0.01, durationMs: 6000 },
        })
        .mockResolvedValueOnce({
          result: mockFactCheckResult,
          meta: { cost: 0.01, durationMs: 6000 },
        });

      const result = await service.factCheckContent(units, 'xai');

      expect(mockProvider.factCheckUnit).toHaveBeenCalledTimes(2);
      expect(result.units).toHaveLength(2);
      expect(result.units[0].factCheckResult).toEqual(mockFactCheckResult);
      expect(result.units[1].factCheckResult).toEqual(mockFactCheckResult);
      expect(result.totalCost).toBe(0.02);
      expect(result.totalDurationMs).toBeGreaterThan(0);
    });

    it('should handle empty units array', async () => {
      const result = await service.factCheckContent([], 'xai');

      expect(mockProvider.factCheckUnit).not.toHaveBeenCalled();
      expect(result.units).toHaveLength(0);
      expect(result.totalCost).toBe(0);
      expect(result.totalDurationMs).toBe(0);
    });

    it('should accumulate costs and duration correctly', async () => {
      const units: ContentUnitAnalysis[] = [
        {
          unitIndex: 0,
          qualityScore: 90,
          qualityReasoning: 'Good',
          originalText: 'Test',
          contentType: 'news',
          categories: [],
          summary: 'Test',
          sentiment: 'neutral',
          keywords: [],
          language: 'en',
          needsFactCheck: true,
        },
      ];

      mockProvider.factCheckUnit.mockResolvedValue({
        result: { verdict: 'verified', score: 0.9, explanation: 'OK', claims: [], searchPerformed: true },
        meta: { cost: 0.015, durationMs: 7500 },
      });

      const result = await service.factCheckContent(units, 'xai');

      expect(result.totalCost).toBe(0.015);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(7500);
    });
  });
});
