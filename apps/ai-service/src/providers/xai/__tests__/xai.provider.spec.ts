import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { XAiProvider } from '../xai.provider';
import { PromptsService } from '../../../prompts/prompts.service';
import { ContentInput, ContentUnitBasic } from '@queue-contracts/ai';

// Mock AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn((params) => params),
  },
}));

jest.mock('@ai-sdk/xai', () => ({
  createXai: jest.fn(() => jest.fn()),
}));

import { generateText } from 'ai';

describe('XAiProvider - Three-Stage Architecture', () => {
  let provider: XAiProvider;
  let mockPromptsService: jest.Mocked<PromptsService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockPromptsService = {
      getPrompt: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XAiProvider,
        {
          provide: PromptsService,
          useValue: mockPromptsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<XAiProvider>(XAiProvider);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('segmentContent (STAGE 1)', () => {
    it('should segment content and return units', async () => {
      const input: ContentInput = {
        text: 'Test content for segmentation. This is second unit.',
        source: {
          platform: 'telegram',
        },
      };

      const mockSystemPrompt = 'System prompt for segmentation';
      mockPromptsService.getPrompt.mockResolvedValue(mockSystemPrompt);

      const mockAiResponse = {
        output: {
          units: [
            {
              unitIndex: 0,
              originalText: 'Test content for segmentation.',
              contentType: 'news',
              qualityScore: 85,
              qualityReasoning: 'High quality news content',
              language: 'en',
            },
            {
              unitIndex: 1,
              originalText: 'This is second unit.',
              contentType: 'other',
              qualityScore: 60,
              qualityReasoning: 'Low quality filler',
              language: 'en',
            },
          ],
        },
        usage: {
          totalTokens: 500,
          inputTokens: 300,
          outputTokens: 200,
        },
        response: {
          id: 'test-request-id',
        },
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.segmentContent(input);

      // Verify prompt loading
      expect(mockPromptsService.getPrompt).toHaveBeenCalledWith(
        'segmentation',
        'segment-content',
      );

      // Verify AI call
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: mockSystemPrompt,
          temperature: 0.3,
        }),
      );

      // Verify result
      expect(result.result.units).toHaveLength(2);
      expect(result.result.units[0].contentType).toBe('news');
      expect(result.result.units[0].qualityScore).toBe(85);
      expect(result.meta.totalTokens).toBe(500);
      expect(result.meta.requestId).toBe('test-request-id');
    });

    it('should handle single unit content', async () => {
      const input: ContentInput = {
        text: 'Single unit content',
        source: { platform: 'rss' },
      };

      mockPromptsService.getPrompt.mockResolvedValue('System prompt');

      const mockAiResponse = {
        output: {
          units: [
            {
              unitIndex: 0,
              originalText: 'Single unit content',
              contentType: 'analysis',
              qualityScore: 90,
              qualityReasoning: 'High quality analysis',
              language: 'en',
            },
          ],
        },
        usage: { totalTokens: 300, inputTokens: 200, outputTokens: 100 },
        response: { id: 'req-2' },
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.segmentContent(input);

      expect(result.result.units).toHaveLength(1);
      expect(result.result.units[0].unitIndex).toBe(0);
    });

    it('should pass custom options to AI', async () => {
      const input: ContentInput = {
        text: 'Test',
        source: { platform: 'telegram' },
      };

      mockPromptsService.getPrompt.mockResolvedValue('System');

      (generateText as jest.Mock).mockResolvedValue({
        output: { units: [] },
        usage: {},
        response: {},
      });

      await provider.segmentContent(input, {
        model: 'grok-2-1212',
        temperature: 0.5,
      });

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        }),
      );
    });
  });

  describe('analyzeContentUnit (STAGE 2)', () => {
    it('should analyze unit and return enriched data', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Bitcoin достиг $100,000',
        contentType: 'news',
        qualityScore: 90,
        qualityReasoning: 'Important financial news',
        language: 'ru',
      };

      const mockSystemPrompt = 'System prompt for analysis';
      mockPromptsService.getPrompt.mockResolvedValue(mockSystemPrompt);

      const mockAiResponse = {
        output: {
          summary: 'Bitcoin достиг исторического максимума',
          entities: [
            {
              type: 'cryptocurrency',
              name: 'Bitcoin',
              context: 'достиг $100,000',
            },
          ],
          keywords: ['Bitcoin', 'криптовалюта', '$100k', 'рекорд'],
          sentiment: 'positive',
          needsFactCheck: true,
          factCheckHint: {
            reason: 'Содержит конкретные ценовые данные',
            targets: [
              {
                claim: 'Bitcoin достиг $100,000',
                queries: [
                  'Bitcoin price USD today',
                  'BTC 100000 all time high January 2026',
                ],
                importance: 'high',
              },
            ],
          },
        },
        usage: {
          totalTokens: 600,
          inputTokens: 350,
          outputTokens: 250,
        },
        response: {
          id: 'analyze-req-1',
        },
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.analyzeContentUnit(unit);

      // Verify prompt loading
      expect(mockPromptsService.getPrompt).toHaveBeenCalledWith(
        'analysis',
        'analyze-unit',
      );

      // Verify result structure
      expect(result.result.unitIndex).toBe(0);
      expect(result.result.originalText).toBe(unit.originalText);
      expect(result.result.summary).toBe('Bitcoin достиг исторического максимума');
      expect(result.result.keywords).toHaveLength(4);
      expect(result.result.sentiment).toBe('positive');
      expect(result.result.needsFactCheck).toBe(true);
      expect(result.result.factCheckHint?.targets).toHaveLength(1);
      expect(result.result.factCheckHint?.targets[0].queries).toHaveLength(2);
    });

    it('should handle unit without fact-check needs', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Simple informational text without claims',
        contentType: 'other',
        qualityScore: 60,
        qualityReasoning: 'Low importance',
        language: 'en',
      };

      mockPromptsService.getPrompt.mockResolvedValue('System prompt');

      const mockAiResponse = {
        output: {
          summary: 'Simple text',
          keywords: ['simple', 'text'],
          sentiment: 'neutral',
          needsFactCheck: false,
        },
        usage: { totalTokens: 200 },
        response: { id: 'req' },
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.analyzeContentUnit(unit);

      expect(result.result.needsFactCheck).toBe(false);
      expect(result.result.factCheckHint).toBeUndefined();
    });

    it('should generate FactCheckTarget with multiple queries', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Complex claim with multiple facts to check',
        contentType: 'news',
        qualityScore: 85,
        qualityReasoning: 'Contains multiple claims',
        language: 'en',
      };

      mockPromptsService.getPrompt.mockResolvedValue('System');

      const mockAiResponse = {
        output: {
          summary: 'Multiple claims',
          keywords: ['claims'],
          sentiment: 'neutral',
          needsFactCheck: true,
          factCheckHint: {
            reason: 'Multiple verifiable claims',
            targets: [
              {
                claim: 'First claim',
                queries: ['query 1', 'query 2', 'query 3'],
                importance: 'high',
              },
              {
                claim: 'Second claim',
                queries: ['query 4', 'query 5'],
                importance: 'medium',
              },
            ],
          },
        },
        usage: {},
        response: {},
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.analyzeContentUnit(unit);

      expect(result.result.factCheckHint?.targets).toHaveLength(2);
      expect(result.result.factCheckHint?.targets[0].queries).toHaveLength(3);
      expect(result.result.factCheckHint?.targets[1].queries).toHaveLength(2);
    });
  });

  describe('factCheckUnit (STAGE 3)', () => {
    it('should fact-check unit using prepared queries', async () => {
      const unit = {
        unitIndex: 0,
        qualityScore: 90,
        qualityReasoning: 'Good',
        originalText: 'Bitcoin достиг $100k',
        contentType: 'news' as const,
        categories: [],
        summary: 'Bitcoin news',
        sentiment: 'positive' as const,
        keywords: ['Bitcoin'],
        language: 'ru',
        needsFactCheck: true,
        factCheckHint: {
          reason: 'Price data',
          targets: [
            {
              claim: 'Bitcoin достиг $100k',
              queries: ['Bitcoin price USD today', 'BTC 100000 January 2026'],
              importance: 'high' as const,
            },
          ],
        },
      };

      const mockSystemPrompt = 'System prompt for fact-check';
      mockPromptsService.getPrompt.mockResolvedValue(mockSystemPrompt);

      const mockAiResponse = {
        output: {
          verdict: 'verified',
          score: 0.9,
          explanation: 'Price data verified through multiple sources',
          claims: [
            {
              claim: 'Bitcoin достиг $100k',
              status: 'verified',
              reasoning: 'Confirmed by CoinMarketCap',
              sources: [
                {
                  url: 'https://coinmarketcap.com',
                  title: 'Bitcoin Price',
                  reliability: 'high',
                  snippet: 'BTC: $100,000',
                },
              ],
            },
          ],
          searchPerformed: true,
        },
        usage: {
          totalTokens: 1500,
          inputTokens: 800,
          outputTokens: 700,
        },
        response: {
          id: 'fact-check-req-1',
        },
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.factCheckUnit(unit);

      // Verify prompt loading
      expect(mockPromptsService.getPrompt).toHaveBeenCalledWith(
        'fact-check',
        'fact-check-default',
      );

      // Verify AI was called with web search enabled
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: expect.objectContaining({
            xai: expect.objectContaining({
              searchParameters: expect.objectContaining({
                mode: 'on',
                returnCitations: true,
              }),
            }),
          }),
        }),
      );

      // Verify result
      expect(result.result.verdict).toBe('verified');
      expect(result.result.score).toBe(0.9);
      expect(result.result.claims).toHaveLength(1);
      expect(result.result.searchPerformed).toBe(true);
    });

    it('should handle unit without factCheckHint', async () => {
      const unit = {
        unitIndex: 0,
        qualityScore: 70,
        qualityReasoning: 'OK',
        originalText: 'Some text',
        contentType: 'other' as const,
        categories: [],
        summary: 'Text',
        sentiment: 'neutral' as const,
        keywords: [],
        language: 'en',
        needsFactCheck: true,
      };

      mockPromptsService.getPrompt.mockResolvedValue('System');

      const mockAiResponse = {
        output: {
          verdict: 'unverified',
          score: 0.3,
          explanation: 'No specific claims to verify',
          claims: [],
          searchPerformed: false,
        },
        usage: {},
        response: {},
      };

      (generateText as jest.Mock).mockResolvedValue(mockAiResponse);

      const result = await provider.factCheckUnit(unit);

      expect(result.result.verdict).toBe('unverified');
      expect(result.result.claims).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle AI errors in segmentContent', async () => {
      const input: ContentInput = {
        text: 'Test',
        source: { platform: 'telegram' },
      };

      mockPromptsService.getPrompt.mockResolvedValue('System');
      (generateText as jest.Mock).mockRejectedValue(new Error('AI API error'));

      await expect(provider.segmentContent(input)).rejects.toThrow('AI API error');
    });

    it('should handle AI errors in analyzeContentUnit', async () => {
      const unit: ContentUnitBasic = {
        unitIndex: 0,
        originalText: 'Test',
        contentType: 'other',
        qualityScore: 70,
        qualityReasoning: 'OK',
        language: 'en',
      };

      mockPromptsService.getPrompt.mockResolvedValue('System');
      (generateText as jest.Mock).mockRejectedValue(new Error('AI API error'));

      await expect(provider.analyzeContentUnit(unit)).rejects.toThrow(
        'AI API error',
      );
    });
  });
});
