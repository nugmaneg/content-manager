import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createXai } from '@ai-sdk/xai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import {
  AiProvider,
  GenerationOptions,
  ContentAnalysisResult,
  ProviderResponse,
} from '../../interfaces/ai-provider.interface';
import {
  FactCheckResult,
  FactCheckContentResult,
  CONTENT_TYPES,
  CONTENT_CATEGORIES,
  FACT_CHECK_VERDICTS,
  SOURCE_RELIABILITY,
  CLAIM_STATUSES,
  FullContentAnalysisResult,
  ContentInput,
  ContentUnitAnalysis,
  PRIMARY_TYPES,
  PrimaryType,
  ContentType,
  ContentCategory,
  ContentStructure,
  ContentUnitBasic,
  ContentSegmentationResult,
} from '@queue-contracts/ai';
import { PromptsService } from '../../prompts/prompts.service';

const DEFAULT_MODEL = 'grok-4-1-fast-reasoning';

@Injectable()
export class XAiProvider implements AiProvider {
  private readonly logger = new Logger(XAiProvider.name);
  private readonly xai;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptsService: PromptsService,
  ) {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('XAI_API_KEY is not set');
    }

    this.xai = createXai({
      apiKey: apiKey,
    });
  }

  async generateText(
    prompt: string,
    options?: GenerationOptions,
  ): Promise<string> {
    try {
      const result = await generateText({
        model: this.xai(options?.model || DEFAULT_MODEL),
        prompt: prompt,
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      return result.text;
    } catch (error) {
      this.logger.error(`Error generating text with xAI: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.warn(
      'Embedding generation requested, but not implemented for xAI yet.',
    );
    throw new Error('Embedding generation not implemented for xAI provider');
  }

  // ===========================================
  // 2-STEP FLOW METHODS
  // ===========================================

  /**
   * @deprecated Используйте analyzeContent(input: ContentInput).
   * Будет удалено после миграции всех вызовов.
   * TODO: Удалить этот метод.
   */
  async _analyzeContent(
    text: string,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentAnalysisResult>> {
    // Загрузка промптов из файлов (новый API)
    const systemPrompt = await this.promptsService.getPrompt('analysis', 'system');
    const userPromptTemplate = await this.promptsService.getPrompt('analysis', 'user');
    const userPrompt = userPromptTemplate.replace(/\{\{text\}\}/g, text);

    // Модель по умолчанию (настройки теперь в конфиге)
    const model = DEFAULT_MODEL;
    const temperature = options?.temperature;

    try {
      // Схема анализа (плоская структура)
      const analysisSchema = z.object({
        // Основной анализ
        summary: z
          .string()
          .describe(
            'Канонический отпечаток для дедупликации. 4–6 предложений (1–3 для коротких текстов). Нейтральный стиль, факты/цифры, фиксированный порядок предложений.',
          ),
        sentiment: z
          .enum(['positive', 'neutral', 'negative', 'unknown'])
          .describe('Эмоциональный окрас контента'),
        keywords: z
          .array(z.string())
          .describe(
            '5–10 ключевых слов в начальной форме, строчными буквами, без пунктуации и стоп-слов.',
          ),
        entities: z
          .object({
            organizations: z
              .array(z.string())
              .optional()
              .describe('Компании, СМИ, госорганы, проекты, сервисы'),
            people: z.array(z.string()).optional().describe('Имена и фамилии'),
            tickers: z
              .array(z.string())
              .optional()
              .describe('Биржевые и крипто-тикеры (AAPL, BTC, ETH)'),
            locations: z
              .array(z.string())
              .optional()
              .describe('Страны, города, регионы'),
          })
          .optional()
          .describe('Сущности, явно упомянутые в тексте'),
        language: z.string().describe('ISO-код языка оригинала'),

        // Классификация
        contentType: z
          .enum(CONTENT_TYPES)
          .describe('Основной тип контенка (соблюдая правила классификации).'),
        secondaryTypes: z
          .array(z.enum(CONTENT_TYPES))
          .optional()
          .describe('Дополнительные типы контента (до 3х шт.)'),
        categories: z
          .array(z.enum(CONTENT_CATEGORIES))
          .describe(
            'Тематические категории (до 5 шт., в зависимости от контента)',
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe('Свободные теги для поиска'),

        // Фактчекинг
        needsFactCheck: z
          .boolean()
          .describe('True, если требуется проверка фактов/цифр/событий'),
        factCheckHint: z
          .object({
            reason: z
              .string()
              .describe('Краткое обоснование необходимости проверки'),
            targets: z
              .object({
                claims: z
                  .array(z.string())
                  .optional()
                  .describe('1–3 самых важных утверждений, требующие проверки'),
                entities: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'Ключевые сущности из утверждений, требующие проверки',
                  ),
              })
              .optional(),
          })
          .optional()
          .describe('Детали для Step 2 (заполнять если needsFactCheck=true)'),
      });

      const result = await generateText({
        model: this.xai(model),
        output: Output.object({ schema: analysisSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
        // БЕЗ webSearch - это важно для экономии
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
      this.logger.error(`Error analyzing content with xAI: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback
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
   * Фактчекинг конкретного юнита контента с веб-поиском.
   * Использует подготовленные queries из factCheckHint.targets[].
   */
  async factCheckUnit(
    unit: ContentUnitAnalysis,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>> {
    const startTime = Date.now();

    // Загрузить system prompt из файла
    const systemPrompt = await this.promptsService.getPrompt(
      'fact-check',
      'fact-check-default',
    );

    // Получить targets из factCheckHint
    const targets = unit.factCheckHint?.targets || [];

    // Сформировать промпт с targets
    const userPrompt = `
Проверь фактические утверждения в следующем тексте:

"${unit.originalText}"

Summary: ${unit.summary}

${targets.length > 0 ? `
УТВЕРЖДЕНИЯ ДЛЯ ПРОВЕРКИ (с рекомендуемыми запросами):

${targets
          .map(
            (t, i) => `
${i + 1}. Утверждение: "${t.claim}"
   Важность: ${t.importance || 'medium'}
   Рекомендуемые поисковые запросы:
   ${t.queries.map((q) => `   - ${q}`).join('\n')}
`,
          )
          .join('\n')}

Используй рекомендованные запросы для веб-поиска, чтобы найти достоверные источники.
` : ''}

Выполни веб-поиск и проверь каждое утверждение.
    `.trim();

    try {
      // Zod схема для FactCheckResult
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

      let searchResultsCount = 0;
      const searchQueries: string[] = [];

      // Вызов с включённым веб-поиском
      const resultRaw = await generateText({
        model: this.xai(options?.model || DEFAULT_MODEL),
        output: Output.object({ schema: factCheckSchema }),
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'on', // Принудительно включаем поиск
              returnCitations: true,
              maxSearchResults: 8,
            },
          },
        },
        onStepFinish: (step) => {
          // Отслеживаем поисковые запросы
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              const toolCall = tc as any;
              if (toolCall.toolName === 'web_search' && toolCall.args?.query) {
                searchQueries.push(toolCall.args.query as string);
              }
            }
          }
          if (step.toolResults && step.toolResults.length > 0) {
            searchResultsCount += step.toolResults.length;
          }
        },
        system: systemPrompt,
        prompt: userPrompt,
        temperature: options?.temperature ?? 0.3,
      });

      const { output, usage, response } = resultRaw;
      const durationMs = Date.now() - startTime;

      const result: FactCheckResult = {
        ...output,
        searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
        searchResultsCount,
      };

      this.logger.log(
        `✅ factCheckUnit: verdict=${result.verdict}, score=${result.score}, ${durationMs}ms`,
      );

      return {
        result,
        meta: {
          model: options?.model || DEFAULT_MODEL,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error in factCheckUnit: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback
      return {
        result: {
          verdict: 'unverified',
          score: 0,
          explanation: 'Error during fact-checking',
          claims: [],
          searchPerformed: false,
        },
        meta: {
          model: options?.model || DEFAULT_MODEL,
        },
      };
    }
  }

  /**
   * STAGE 3: Факт-чекинг контента (batch).
   * Обрабатывает массив ContentUnitAnalysis и возвращает результат.
   *
   * @param units - Массив ContentUnitAnalysis для факт-чекинга
   * @param options - Опции генерации
   * @returns FactCheckContentResult
   */
  async factCheckContent(
    units: ContentUnitAnalysis[],
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckContentResult>> {
    const startTime = Date.now();
    const results: ContentUnitAnalysis[] = [];
    let totalCost = 0;

    this.logger.log(
      `🚀 factCheckContent: starting fact-check for ${units.length} units`,
    );

    for (const unit of units) {
      const { result: factCheckResult, meta } = await this.factCheckUnit(
        unit,
        options,
      );

      // Добавить факт-чекинг к unit
      unit.factCheckResult = factCheckResult;
      results.push(unit);

      // Примерная стоимость (можно улучшить с реальными данными от xAI)
      if (meta.totalTokens) {
        const estimatedCost = (meta.totalTokens / 1000000) * 10; // ~$10 per 1M tokens
        totalCost += estimatedCost;
      }
    }

    const totalDurationMs = Date.now() - startTime;

    this.logger.log(
      `✅ factCheckContent: ${results.length} units checked, cost=$${totalCost.toFixed(4)}, ${totalDurationMs}ms`,
    );

    return {
      result: {
        units: results,
        totalCost,
        totalDurationMs,
      },
      meta: {
        model: options?.model || DEFAULT_MODEL,
      },
    };
  }

  /**
   * @deprecated Используйте factCheckUnit(unit: ContentUnitAnalysis).
   * Будет удалено после миграции всех вызовов.
   */
  async _factCheckContent(
    text: string,
    analysis: ContentAnalysisResult,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>> {
    // Загрузка промптов из файлов (новый API)
    const systemPrompt = await this.promptsService.getPrompt('fact-check', 'system');
    const userPromptTemplate = await this.promptsService.getPrompt('fact-check', 'user');

    // Получаем claims из анализа (если есть)
    const claimsToCheck = analysis.factCheckHint?.targets?.claims || [];
    const entitiesToCheck = analysis.factCheckHint?.targets?.entities || [];

    // Ручной рендеринг шаблона
    const userPrompt = userPromptTemplate
      .replace(/\{\{text\}\}/g, text)
      .replace(/\{\{entities\}\}/g, JSON.stringify(analysis.entities))
      .replace(/\{\{summary\}\}/g, analysis.summary)
      .replace(/\{\{keywords\}\}/g, analysis.keywords.join(', '))
      .replace(/\{\{claims\}\}/g, claimsToCheck.join('\n- '))
      .replace(/\{\{entitiesToCheck\}\}/g, entitiesToCheck.join(', '));

    // Модель по умолчанию (настройки теперь в конфиге)
    const model = DEFAULT_MODEL;
    const temperature = options?.temperature;

    try {
      // Zod схема для FactCheckResult (используем константы из контракта)
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

      let searchResultsCount = 0;
      const searchQueries: string[] = [];

      const resultRaw = await generateText({
        model: this.xai(model),
        output: Output.object({ schema: factCheckSchema }),
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'on', // ПРИНУДИТЕЛЬНО включаем поиск
              returnCitations: true,
              maxSearchResults: 8,
            },
          },
        },
        onStepFinish: (step) => {
          // Отслеживаем поисковые запросы
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              const toolCall = tc as any;
              if (toolCall.toolName === 'web_search' && toolCall.args?.query) {
                searchQueries.push(toolCall.args.query as string);
              }
            }
          }
          if (step.toolResults && step.toolResults.length > 0) {
            searchResultsCount += step.toolResults.length;
          }
          if (step.sources && step.sources.length > 0) {
            this.logger.debug(`Sources found: ${step.sources.length}`);
          }
        },
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
      });

      const { output, usage, response } = resultRaw;

      const result: FactCheckResult = {
        ...output,
        searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
        searchResultsCount,
      };



      return {
        result,
        meta: {
          model,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error fact-checking content with xAI: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback
      return {
        result: {
          verdict: 'unverified',
          score: 0,
          explanation: 'Error during fact-checking',
          claims: [],
          searchPerformed: false,
        },
        meta: {
          model,
        },
      };
    }
  }

  // ===========================================
  // THREE-STAGE ARCHITECTURE METHODS
  // ===========================================

  /**
   * STAGE 1: Сегментация контента на смысловые единицы (ContentUnits).
   * Быстрый этап: ~4-6 сек, ~$0.003
   *
   * @param input - Входной контент (текст + метаданные)
   * @param options - Опции генерации
   * @returns ContentSegmentationResult с массивом ContentUnitBasic
   */
  async segmentContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentSegmentationResult>> {
    const startTime = Date.now();

    // Загрузить system prompt из файла
    const systemPrompt = await this.promptsService.getPrompt(
      'segmentation',
      'segment-content',
    );

    // Сформировать user prompt
    const userPrompt = `
Проанализируй следующий контент и раздели его на логические смысловые единицы (units).

Контент:
"${input.text}"

Платформа: ${input.source.platform}
${'authorUsername' in input.source && input.source.authorUsername ? `Автор: ${input.source.authorUsername}` : ''}
${input.media && input.media.length > 0 ? `Медиа: ${input.media.length} файлов` : ''}

Для каждого unit определи:
- unitIndex — порядковый номер unit (0, 1, 2...)
- originalText — текст unit (дословно из оригинала)
- contentType — тип контента (news/opinion/analysis/guide/announcement/discussion/entertainment/promotion/other)
- qualityScore — оценка значимости (0-100)
- qualityReasoning — пояснение оценки (1-2 предложения)
- language — язык контента (ru/en/uk/...)

Верни JSON массив units.
    `.trim();

    // Zod схема для сегментации
    const segmentationSchema = z.object({
      units: z.array(
        z.object({
          unitIndex: z.number(),
          originalText: z.string(),
          contentType: z.enum(CONTENT_TYPES),
          qualityScore: z.number().min(0).max(100),
          qualityReasoning: z.string(),
          language: z.string(),
        }),
      ),
    });

    try {
      // Вызов AI
      const result = await generateText({
        model: this.xai(options?.model || DEFAULT_MODEL),
        output: Output.object({ schema: segmentationSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: options?.temperature ?? 0.3,
      });

      const { output, usage, response } = result;
      const durationMs = Date.now() - startTime;

      this.logger.log(
        `✅ segmentContent: ${output.units.length} units, ${durationMs}ms, tokens=${usage?.totalTokens}`,
      );

      return {
        result: output as ContentSegmentationResult,
        meta: {
          model: options?.model || DEFAULT_MODEL,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error in segmentContent: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * STAGE 2: Глубокий анализ ContentUnit.
   * Средний этап: ~2-3 сек на unit, ~$0.002
   *
   * @param unit - ContentUnitBasic для анализа
   * @param options - Опции генерации
   * @returns ContentUnitAnalysis с enriched данными
   */
  async analyzeContentUnit(
    unit: ContentUnitBasic,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentUnitAnalysis>> {
    const startTime = Date.now();

    // Загрузить system prompt из файла
    const systemPrompt = await this.promptsService.getPrompt(
      'analysis',
      'analyze-unit',
    );

    // Сформировать user prompt
    const userPrompt = `
Проведи глубокий анализ следующего контента:

"${unit.originalText}"

Тип: ${unit.contentType}
Язык: ${unit.language}
Quality Score: ${unit.qualityScore}

Верни:
1. summary — краткое изложение (до 25 слов)
2. entities — сущности (люди, места, организации, даты...)
3. keywords — ключевые слова (3-7 штук)
4. sentiment — тональность (positive/neutral/negative, score 0-1)
5. needsFactCheck — нужен ли факт-чекинг (true/false)
6. factCheckHint — если needsFactCheck=true, то укажи:
   - reason — почему нужен факт-чекинг
   - targets — список утверждений с поисковыми запросами:
     - claim — утверждение для проверки
     - queries — массив поисковых запросов (2-5 штук)
     - importance — важность (high/medium/low)
    `.trim();

    // Zod схема для анализа unit
    const factCheckTargetSchema = z.object({
      claim: z.string(),
      queries: z.array(z.string()),
      importance: z.enum(['high', 'medium', 'low']).optional(),
    });

    const factCheckHintSchema = z.object({
      reason: z.string(),
      targets: z.array(factCheckTargetSchema),
    });

    const unitAnalysisSchema = z.object({
      summary: z.string(),
      entities: z
        .object({
          organizations: z.array(z.string()).optional(),
          people: z.array(z.string()).optional(),
          tickers: z.array(z.string()).optional(),
          locations: z.array(z.string()).optional(),
        })
        .optional(),
      keywords: z.array(z.string()),
      sentiment: z.object({
        label: z.enum(['positive', 'neutral', 'negative']),
        score: z.number().min(0).max(1),
      }),
      needsFactCheck: z.boolean(),
      factCheckHint: factCheckHintSchema.optional(),
    });

    try {
      // Вызов AI
      const result = await generateText({
        model: this.xai(options?.model || DEFAULT_MODEL),
        output: Output.object({ schema: unitAnalysisSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: options?.temperature ?? 0.3,
      });

      const { output, usage, response } = result;
      const durationMs = Date.now() - startTime;

      // Собрать финальный результат (соединить с базовыми полями)
      const analysisResult: ContentUnitAnalysis = {
        unitIndex: unit.unitIndex,
        qualityScore: unit.qualityScore,
        qualityReasoning: unit.qualityReasoning,
        originalText: unit.originalText,
        contentType: unit.contentType,
        categories: [], // Оставляем пустым, так как в новой архитектуре это не заполняется на Stage 2
        summary: output.summary,
        sentiment: output.sentiment.label, // Используем только label, а не весь объект
        keywords: output.keywords,
        language: unit.language,
        entities: output.entities,
        needsFactCheck: output.needsFactCheck,
        factCheckHint: output.factCheckHint,
        // factCheckResult будет заполнено позже (в Stage 3)
      };

      this.logger.log(
        `✅ analyzeContentUnit: unit ${unit.unitIndex}, needsFactCheck=${output.needsFactCheck}, ${durationMs}ms`,
      );

      return {
        result: analysisResult,
        meta: {
          model: options?.model || DEFAULT_MODEL,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error in analyzeContentUnit: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Основной метод анализа контента с сегментацией на юниты.
   * Принимает полный ContentInput (текст + медиа + источник).
   *
   * TODO: Доделать промпты
   */
  async analyzeContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FullContentAnalysisResult>> {
    const text = input.text;

    // Используем новый API PromptsService
    const systemPrompt = await this.promptsService.getPrompt('analysis', 'system');
    const userPromptTemplate = await this.promptsService.getPrompt('analysis', 'user');
    const userPrompt = userPromptTemplate.replace(/\{\{text\}\}/g, text);

    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.2;

    try {
      // Схема для юнита
      const unitSchema = z
        .object({
          unitIndex: z
            .number()
            .describe(
              'Порядковый индекс смыслового юнита в рамках входного сообщения (0..N-1) в порядке появления в тексте.'
            ),

          qualityScore: z
            .number()
            .min(0)
            .max(100)
            .describe(
              'Оценка качества/полезности юнита по шкале 0–100: 100 — максимально информативно и самодостаточно, 0 — шум/пусто.'
            ),

          qualityReasoning: z
            .string()
            .describe(
              'Краткое обоснование выставленного qualityScore (1–2 предложения). Должно ссылаться на конкретные признаки: наличие фактов/цифр, самодостаточность, уровень шума, кликбейт и т.п.'
            ),

          originalText: z
            .string()
            .describe(
              'Дословный фрагмент исходного сообщения, относящийся к данному юниту (без перефразирования). Используется для трассировки и воспроизводимости сегментации.'
            ),

          contentType: z
            .enum(CONTENT_TYPES)
            .describe(
              'Основной тип (функция) юнита: что делает этот фрагмент — сообщает факт (news), объясняет (analysis), выражает мнение (opinion), обучает (guide), объявляет (announcement), рекламирует (ad), и т.д. Выбирается по содержанию самого юнита.'
            ),

          secondaryTypes: z
            .array(z.enum(CONTENT_TYPES))
            .optional()
            .describe(
              'Дополнительные типы юнита (1–2 максимум). Указывать только если юнит реально совмещает функции и вторичный тип заметен по тексту.'
            ),

          categories: z
            .array(z.enum(CONTENT_CATEGORIES))
            .describe(
              'Категории юнита из контрактного списка. Рекомендуемо 1–3 наиболее точных значений; если неясно — использовать категорию "other" (если предусмотрена контрактом).'
            ),

          tags: z
            .array(z.string())
            .optional()
            .describe(
              'Свободные короткие теги для поиска/фильтрации. Не должны дословно дублировать keywords; допустимы более “прикладные” метки (например, формат, аудитория, контекст).'
            ),

          summary: z
            .string()
            .describe(
              'Каноническое нейтральное резюме юнита (обычно 4–6 предложений), предназначенное для стабильного сравнения/дедупликации. Без рекламных вставок, призывов подписаться и ссылочных тизеров; включает числа/даты/проценты, если они есть.'
            ),

          sentiment: z
            .enum(['positive', 'neutral', 'negative', 'unknown'])
            .describe(
              'Тональность юнита: positive/negative — выраженная оценка, neutral — информационно-нейтрально (по умолчанию), unknown — нельзя определить по тексту.'
            ),

          keywords: z
            .array(z.string())
            .describe(
              'Ключевые слова по теме юнита (рекомендуемо 5–10): строчными буквами, без пунктуации и эмодзи, без стоп-слов, без дублей, по возможности в начальной форме.'
            ),

          language: z
            .string()
            .describe(
              'Язык юнита (например: "ru", "en", "uk", "mixed"). "mixed" использовать, если внутри юнита существенно смешаны языки и нет доминирующего.'
            ),

          entities: z
            .object({
              organizations: z
                .array(z.string())
                .optional()
                .describe(
                  'Организации, компании, бренды, госорганы, СМИ, платформы, проекты, сервисы, явно упомянутые в юните.'
                ),

              people: z
                .array(z.string())
                .optional()
                .describe('Люди (имена/фамилии/ФИО), явно упомянутые в юните.'),

              tickers: z
                .array(z.string())
                .optional()
                .describe(
                  'Биржевые тикеры (например, AAPL, BTC, ETH) — только если в тексте указан именно тикер/обозначение, а не название компании/актива.'
                ),

              locations: z
                .array(z.string())
                .optional()
                .describe('Географические сущности (страны/города/регионы), явно упомянутые в юните.'),
            })
            .optional()
            .describe(
              'Извлечённые именованные сущности из текста юнита. Добавлять только то, что явно присутствует в тексте (или в описании медиа, если юнит на него опирается).'
            ),

          linkedMediaIndexes: z
            .array(z.number())
            .optional()
            .describe(
              'Индексы медиа-элементов (0..M-1), семантически связанных с данным юнитом. Указывать, если юнит описывает или опирается на конкретное медиа по его подписи/alt/описанию.'
            ),

          needsFactCheck: z
            .boolean()
            .describe(
              'Флаг необходимости факт-чекинга для юнита. true — если есть проверяемые утверждения (цифры, даты, проценты, “по данным”, факты событий, правовые/регуляторные заявления); false — если это чистое мнение без проверяемых фактов, юмор или общие советы без конкретики.'
            ),

          factCheckHint: z
            .object({
              reason: z
                .string()
                .describe(
                  'Короткое объяснение, почему юнит требует факт-чекинга (например: “есть конкретные суммы и утверждение о событии/источнике”).'
                ),

              targets: z
                .object({
                  claims: z
                    .array(z.string())
                    .optional()
                    .describe(
                      '1–3 ключевых проверяемых утверждения из юнита (дословно или почти дословно). Не добавлять интерпретации или уточнения, которых нет в тексте.'
                    ),

                  entities: z
                    .array(z.string())
                    .optional()
                    .describe(
                      'Ключевые сущности, фигурирующие в claims (организации/персоны/платформы/объекты), чтобы упростить поиск первоисточников.'
                    ),
                })
                .optional()
                .describe('Цели факт-чекинга: какие именно утверждения и сущности нужно проверять в первую очередь.'),
            })
            .optional()
            .describe(
              'Подсказка для факт-чекинга. Должна присутствовать, только если needsFactCheck=true. Если needsFactCheck=false — поле не указывать.'
            ),
        })
        .describe(
          'Смысловой юнит — логически цельный фрагмент исходного сообщения (одна тема/сюжет/функция), анализируемый как самостоятельная единица.'
        );

      // Полная схема ответа
      const segmentationSchema = z
        .object({
          structure: z
            .object({
              isComplex: z
                .boolean()
                .describe(
                  'Признак сложной структуры входа: true, если сообщение содержит несколько смысловых юнитов (unitsCount>1) или явно смешивает темы/типы (например, новость + реклама/мнение/дайджест).'
                ),

              unitsCount: z
                .number()
                .describe('Количество выделенных смысловых юнитов. Должно строго совпадать с units.length.'),
            })
            .describe('Сводные метаданные о сегментации входного сообщения.'),

          units: z
            .array(unitSchema)
            .describe(
              'Список смысловых юнитов, выделенных из входного сообщения. Порядок должен соответствовать порядку появления в тексте (unitIndex 0..N-1).'
            ),

          aggregated: z
            .object({
              primaryType: z
                .enum(PRIMARY_TYPES)
                .describe(
                  'Доминирующий тип контента для всего сообщения (по совокупности юнитов). Выбирается как основной вклад: учитывает смысловую центральность и “вес” юнитов (например, по qualityScore).'
                ),

              allTypes: z
                .array(z.enum(CONTENT_TYPES))
                .describe(
                  'Уникальный список всех типов контента, встречающихся в units (включая secondaryTypes), без дублей.'
                ),

              allCategories: z
                .array(z.enum(CONTENT_CATEGORIES))
                .describe('Уникальный список всех категорий из units, без дублей.'),

              allKeywords: z
                .array(z.string())
                .describe(
                  'Объединённый набор ключевых слов по всем юнитам, без дублей, строчными буквами. Рекомендуемо оставлять наиболее смыслообразующие, чтобы не раздувать список.'
                ),

              combinedSummary: z
                .string()
                .describe(
                  'Нейтральное итоговое резюме всего сообщения (обычно 5–8 предложений), которое последовательно объединяет содержание всех юнитов по порядку появления.'
                ),

              allEntities: z
                .object({
                  organizations: z
                    .array(z.string())
                    .optional()
                    .describe('Объединённый список организаций из всех юнитов, без дублей.'),

                  people: z
                    .array(z.string())
                    .optional()
                    .describe('Объединённый список людей из всех юнитов, без дублей.'),

                  tickers: z
                    .array(z.string())
                    .optional()
                    .describe('Объединённый список тикеров из всех юнитов, без дублей.'),

                  locations: z
                    .array(z.string())
                    .optional()
                    .describe('Объединённый список локаций из всех юнитов, без дублей.'),
                })
                .optional()
                .describe(
                  'Сводные именованные сущности по всему сообщению (объединение entities всех юнитов). Если сущностей нет, поле может отсутствовать.'
                ),

              language: z
                .string()
                .describe(
                  'Основной язык всего сообщения по всем юнитам (например: "ru", "en", "mixed"). "mixed" — если нет доминирующего языка.'
                ),
            })
            .describe('Агрегированное представление сообщения (мостик для совместимости и быстрых фильтров/витрин).'),
        })
        .describe(
          'Результат сегментации и анализа: структура (мета), список юнитов (детально) и агрегированное представление (сводно).'
        );

      const startTime = Date.now();

      const result = await generateText({
        model: this.xai(model),
        output: Output.object({ schema: segmentationSchema }),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
      });

      const { output, usage, response } = result;
      const durationMs = Date.now() - startTime;



      // Формируем полный результат
      const fullResult: FullContentAnalysisResult = {
        structure: output.structure as ContentStructure,
        units: output.units as ContentUnitAnalysis[],
        aggregated: {
          primaryType: output.aggregated.primaryType as PrimaryType,
          allTypes: output.aggregated.allTypes as ContentType[],
          allCategories: output.aggregated.allCategories as ContentCategory[],
          allKeywords: output.aggregated.allKeywords,
          combinedSummary: output.aggregated.combinedSummary,
          language: output.aggregated.language,
          allEntities: {
            organizations: output.aggregated.allEntities?.organizations || [],
            people: output.aggregated.allEntities?.people || [],
            tickers: output.aggregated.allEntities?.tickers || [],
            locations: output.aggregated.allEntities?.locations || [],
          },
        },
        analyzedAt: new Date().toISOString(),
        providerMeta: {
          contentAnalysis: {
            provider: 'xai',
            model,
            totalTokens: usage?.totalTokens,
            promptTokens: usage?.inputTokens,
            completionTokens: usage?.outputTokens,
            durationMs,
            requestId: response?.id,
          },
        },
        totalDurationMs: durationMs,
      };

      return {
        result: fullResult,
        meta: {
          model,
          totalTokens: usage?.totalTokens,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          requestId: response?.id,
        },
      };
    } catch (error) {
      this.logger.error(`Error in analyzeContentWithSegmentation: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
