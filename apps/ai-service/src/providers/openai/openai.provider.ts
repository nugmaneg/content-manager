import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, embed, Output } from 'ai';
import { z } from 'zod';
import {
  AiProvider,
  GenerationOptions,
  ContentAnalysisResult,
  ProviderResponse,
} from '../../interfaces/ai-provider.interface';
import {
  FactCheckResult,
  CONTENT_TYPES,
  CONTENT_CATEGORIES,
  FACT_CHECK_VERDICTS,
  SOURCE_RELIABILITY,
  CLAIM_STATUSES,
  ContentInput,
  FullContentAnalysisResult,
  ContentUnitAnalysis,
} from '@queue-contracts/ai';
import { PromptsService } from '../../prompts/prompts.service';

const DEFAULT_MODEL = 'gpt-5-mini';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly openai;
  private readonly embeddingModel = 'text-embedding-3-small';

  constructor(
    private readonly configService: ConfigService,
    private readonly promptsService: PromptsService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set');
    }

    this.openai = createOpenAI({
      apiKey: apiKey,
    });
  }

  async generateText(
    prompt: string,
    options?: GenerationOptions,
  ): Promise<string> {
    try {
      const result = await generateText({
        model: this.openai(options?.model || DEFAULT_MODEL),
        prompt: prompt,
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      return result.text;
    } catch (error) {
      this.logger.error(`Error generating text with OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.debug(`Generating embedding for text (${text.length} chars)`);

      const { embedding } = await embed({
        model: this.openai.embedding(this.embeddingModel),
        value: text,
      });

      this.logger.debug(
        `Generated embedding with ${embedding.length} dimensions`,
      );
      return embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding with OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // ===========================================
  // THREE-STAGE ARCHITECTURE METHODS
  // ===========================================

  /**
   * STAGE 1: Сегментация контента на смысловые единицы.
   * TODO: Not implemented for OpenAI provider yet.
   */
  async segmentContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<any>> {
    throw new Error('segmentContent() not implemented for OpenAI provider. Use XAI provider instead.');
  }

  /**
   * STAGE 2: Глубокий анализ ContentUnit.
   * TODO: Not implemented for OpenAI provider yet.
   */
  async analyzeContentUnit(
    unit: any,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentUnitAnalysis>> {
    throw new Error('analyzeContentUnit() not implemented for OpenAI provider. Use XAI provider instead.');
  }

  /**
   * STAGE 3: Факт-чекинг контента (batch).
   * TODO: Not implemented for OpenAI provider yet.
   */
  async factCheckContent(
    units: ContentUnitAnalysis[],
    options?: GenerationOptions,
  ): Promise<ProviderResponse<any>> {
    throw new Error('factCheckContent() not implemented for OpenAI provider. Use XAI provider instead.');
  }

  // ===========================================
  // 2-STEP FLOW METHODS
  // ===========================================

  /**
   * Основной метод анализа контента с сегментацией.
   * TODO: Реализовать полноценную сегментацию как в XAiProvider.
   * Пока что использует _analyzeContent и оборачивает в FullContentAnalysisResult.
   */
  async analyzeContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FullContentAnalysisResult>> {
    // Временная реализация: используем legacy метод и оборачиваем
    const legacyResult = await this._analyzeContent(input.text, options);

    const now = new Date().toISOString();
    return {
      result: {
        structure: { isComplex: false, unitsCount: 1 },
        units: [{
          unitIndex: 0,
          qualityScore: 50, // Неизвестно без полноценного анализа
          qualityReasoning: 'Legacy analysis - quality not evaluated',
          originalText: input.text,
          contentType: legacyResult.result.contentType,
          secondaryTypes: legacyResult.result.secondaryTypes,
          categories: legacyResult.result.categories,
          tags: legacyResult.result.tags,
          summary: legacyResult.result.summary,
          sentiment: legacyResult.result.sentiment,
          keywords: legacyResult.result.keywords,
          language: legacyResult.result.language,
          entities: legacyResult.result.entities,
          needsFactCheck: legacyResult.result.needsFactCheck,
          factCheckHint: legacyResult.result.factCheckHint ? {
            reason: legacyResult.result.factCheckHint.reason,
            targets: [], // Legacy format doesn't have structured targets
          } : undefined,
        }],
        aggregated: {
          primaryType: legacyResult.result.contentType,
          allTypes: [legacyResult.result.contentType, ...(legacyResult.result.secondaryTypes || [])],
          allCategories: legacyResult.result.categories,
          allKeywords: legacyResult.result.keywords,
          combinedSummary: legacyResult.result.summary,
          allEntities: legacyResult.result.entities || {},
          language: legacyResult.result.language,
        },
        analyzedAt: now,
        providerMeta: {
          contentAnalysis: {
            provider: 'openai',
            model: legacyResult.meta.model,
            totalTokens: legacyResult.meta.totalTokens,
            promptTokens: legacyResult.meta.promptTokens,
            completionTokens: legacyResult.meta.completionTokens,
            durationMs: 0, // TODO: track duration properly
            requestId: legacyResult.meta.requestId,
          },
        },
        totalDurationMs: 0,
      },
      meta: legacyResult.meta,
    };
  }

  /**
   * @deprecated Используйте analyzeContent(input: ContentInput).
   * Будет удалено после миграции.
   * TODO: Удалить этот метод.
   */
  async _analyzeContent(
    text: string,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentAnalysisResult>> {
    // Используем новый API PromptsService
    const systemPrompt = await this.promptsService.getPrompt('analysis', 'system');
    const userPromptTemplate = await this.promptsService.getPrompt('analysis', 'user');
    const userPrompt = userPromptTemplate.replace(/\{\{text\}\}/g, text);

    // Модель берём из опций или дефолт
    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature;

    try {
      const analysisSchema = z.object({
        // Основной анализ
        summary: z
          .string()
          .describe('Краткое содержание на русском, 2-3 предложения'),
        sentiment: z
          .enum(['positive', 'neutral', 'negative', 'unknown'])
          .describe('Эмоциональный окрас'),
        keywords: z.array(z.string()).describe('5-10 ключевых слов'),
        entities: z
          .object({
            organizations: z
              .array(z.string())
              .optional()
              .describe('Организации'),
            people: z.array(z.string()).optional().describe('Люди'),
            tickers: z.array(z.string()).optional().describe('Биржевые тикеры'),
            locations: z.array(z.string()).optional().describe('Локации'),
          })
          .optional()
          .describe('Извлечённые сущности'),
        language: z.string().describe('ISO-код языка оригинала'),

        // Классификация (используем константы из контракта)
        contentType: z.enum(CONTENT_TYPES).describe('Основной тип контента'),
        secondaryTypes: z
          .array(z.enum(CONTENT_TYPES))
          .optional()
          .describe('Дополнительные типы (макс 1-2)'),
        categories: z
          .array(z.enum(CONTENT_CATEGORIES))
          .describe('Тематические категории (1-3 штуки)'),
        tags: z.array(z.string()).optional().describe('Свободные теги'),

        // Фактчекинг
        needsFactCheck: z.boolean().describe('Нужна ли проверка фактов'),
        factCheckHint: z
          .object({
            reason: z.string().describe('Почему нужна/не нужна проверка'),
            targets: z
              .object({
                claims: z
                  .array(z.string())
                  .optional()
                  .describe('Конкретные утверждения для проверки'),
                entities: z
                  .array(z.string())
                  .optional()
                  .describe('Сущности для проверки'),
              })
              .optional(),
          })
          .optional()
          .describe(
            'Детали для фактчекинга (заполнять если needsFactCheck=true)',
          ),
      });

      const result = await generateText({
        model: this.openai(model),
        output: Output.object({ schema: analysisSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
      });

      const { output, usage, response } = result;



      return {
        result: output as ContentAnalysisResult,
        meta: {
          model,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error analyzing content with OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      return {
        result: {
          summary: text.slice(0, 100) + '...',
          sentiment: 'unknown',
          keywords: [],
          language: 'unknown',
          contentType: 'other',
          categories: ['other'],
          needsFactCheck: false,
        },
        meta: {
          model,
        },
      };
    }
  }

  // ===========================================
  // FACT-CHECKING METHODS
  // ===========================================

  /**
   * Фактчекинг конкретного юнита контента.
   * Использует данные из ContentUnitAnalysis для формирования запроса.
   */
  async factCheckUnit(
    unit: ContentUnitAnalysis,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>> {
    // Создаём legacy-совместимый объект для _factCheckContent
    const legacyAnalysis: ContentAnalysisResult = {
      summary: unit.summary,
      sentiment: unit.sentiment,
      keywords: unit.keywords,
      entities: unit.entities,
      language: unit.language,
      contentType: unit.contentType,
      secondaryTypes: unit.secondaryTypes,
      categories: unit.categories,
      tags: unit.tags,
      needsFactCheck: unit.needsFactCheck,
      factCheckHint: unit.factCheckHint ? {
        reason: unit.factCheckHint.reason,
        targets: {
          claims: unit.factCheckHint.targets?.map(t => t.claim) || [],
          entities: [], // Legacy format doesn't have entities list
        },
      } : undefined,
    };

    return this._factCheckContent(unit.originalText, legacyAnalysis, options);
  }

  /**
   * @deprecated Используйте factCheckUnit(unit: ContentUnitAnalysis).
   * Будет удалено после миграции всех вызовов.
   * OpenAI не имеет встроенного веб-поиска, но следует той же схеме.
   */
  async _factCheckContent(
    text: string,
    analysis: ContentAnalysisResult,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>> {
    // Используем новый API PromptsService
    const systemPrompt = await this.promptsService.getPrompt('fact-check', 'system');
    const userPromptTemplate = await this.promptsService.getPrompt('fact-check', 'user');

    const claimsToCheck = analysis.factCheckHint?.targets?.claims || [];
    const entitiesToCheck = analysis.factCheckHint?.targets?.entities || [];

    // Подстановка переменных вручную
    let userPrompt = userPromptTemplate
      .replace(/\{\{text\}\}/g, text)
      .replace(/\{\{entities\}\}/g, JSON.stringify(analysis.entities))
      .replace(/\{\{summary\}\}/g, analysis.summary)
      .replace(/\{\{keywords\}\}/g, analysis.keywords.join(', '))
      .replace(/\{\{claims\}\}/g, claimsToCheck.join('\n- '))
      .replace(/\{\{entitiesToCheck\}\}/g, entitiesToCheck.join(', '));

    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature;

    try {
      // Те же схемы что и в XAiProvider
      const sourceSchema = z.object({
        url: z.string(),
        title: z.string().optional(),
        publisher: z.string().optional(),
        publishedAt: z.string().optional(),
        quote: z.string().optional(),
        reliability: z.enum(SOURCE_RELIABILITY).optional(),
      });

      const claimVerificationSchema = z.object({
        claim: z.string(),
        status: z.enum(CLAIM_STATUSES),
        verdict: z.enum(FACT_CHECK_VERDICTS).optional(),
        score: z.number().min(0).max(1).optional(),
        explanation: z.string(),
        sources: z.array(sourceSchema),
      });

      const factCheckSchema = z.object({
        verdict: z.enum(FACT_CHECK_VERDICTS),
        score: z.number().min(0).max(1),
        explanation: z.string(),
        claims: z.array(claimVerificationSchema),
        searchPerformed: z.boolean(),
      });

      const result = await generateText({
        model: this.openai(model),
        output: Output.object({ schema: factCheckSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
        // OpenAI здесь не имеет встроенного поиска как Grok через searchParameters
      });

      const { output, usage, response } = result;

      return {
        result: {
          ...output,
          searchQueries: [], // OpenAI не возвращает запросы без кастомных инструментов
          searchResultsCount: 0,
        },
        meta: {
          model,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error fact-checking content with OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      return {
        result: {
          verdict: 'unverified',
          score: 0,
          explanation: 'Error during fact-checking with OpenAI',
          claims: [],
          searchPerformed: false,
        },
        meta: {
          model,
        },
      };
    }
  }
}
