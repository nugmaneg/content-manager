import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createXai } from '@ai-sdk/xai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { AiProvider, AiAnalysisResult, GenerationOptions } from '../../interfaces/ai-provider.interface';

@Injectable()
export class XAiProvider implements AiProvider {
    private readonly logger = new Logger(XAiProvider.name);
    private readonly xai;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('XAI_API_KEY');
        if (!apiKey) {
            this.logger.warn('XAI_API_KEY is not set');
        }

        this.xai = createXai({
            apiKey: apiKey,
        });
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
        try {
            const { text } = await generateText({
                model: this.xai(options?.model || 'grok-4-1-fast-reasoning'),
                prompt: prompt,
                maxOutputTokens: options?.maxTokens,
                temperature: options?.temperature,
            });

            return text;
        } catch (error) {
            this.logger.error('Error generating text with xAI', error);
            throw error;
        }
    }

    async analyzeText(text: string): Promise<AiAnalysisResult> {
        try {
            // Chat completions with response_format=json_schema to get strict JSON.
            const analysisSchema = z.object({
                summary: z.string().describe('Краткое содержание новости на русском языке'),
                sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']).describe('Эмоциональный окрас текста'),
                keywords: z.array(z.string()).describe('Список ключевых слов'),
                entities: z.object({
                    organizations: z.array(z.string()).optional().describe('Упомянутые организации'),
                    people: z.array(z.string()).optional().describe('Упомянутые люди'),
                    tickers: z.array(z.string()).optional().describe('Биржевые тикеры (BTC, TON и т.д.)'),
                    locations: z.array(z.string()).optional().describe('Географические локации'),
                }).optional().describe('Извлеченные сущности (NER)'),
                category: z.string().optional().describe('Категория контента'),
                language: z.string().optional().describe('Язык оригинала (ISO код)'),
                factCheck: z.object({
                    verdict: z.enum(['verified', 'partially_true', 'false', 'unverified', 'opinion']).describe('Вердикт факт-чекинга'),
                    score: z.number().min(0).max(1).describe('Оценка достоверности (0-1)'),
                    explanation: z.string().describe('Объяснение вердикта на русском языке'),
                    sources: z.array(z.string()).optional().describe('Список ссылок (URL) на источники, использованные для проверки'),
                }).optional().describe('Результаты факт-чекинга'),
            });

            // use chat completions + Output.object to get strict JSON via response_format=json_schema
            const { output } = await generateText({
                model: this.xai('grok-4-1-fast-reasoning'),
                output: Output.object({
                    schema: analysisSchema,
                }),
                providerOptions: {
                    xai: {
                        // allow model to decide when to search; xAI will fetch citations when needed
                        searchParameters: {
                            mode: 'auto',
                            returnCitations: true,
                            maxSearchResults: 8,
                        },
                    },
                },
                onStepFinish: step => {
                    this.logger.debug(
                        `xAI step: ${JSON.stringify(
                            {
                                text: step.text?.slice(0, 300),
                                reasoning: step.reasoning?.slice(0, 300),
                                toolCalls: step.toolCalls,
                                toolResults: step.toolResults,
                                sources: step.sources,
                            },
                        )}`,
                    );
                },
                system: `Ты — аналитик Telegram. Всегда возвращай ТОЛЬКО JSON по схеме, без Markdown и лишних ключей.
                Делай краткое резюме (summary) на русском, не более 3 предложений, независимо от языка оригинала.
                Извлекай сущности (имена, компании, тикеры, локации), keywords — 5-10 слов, строчные.
                Если в тексте есть проверяемые факты (даты, события, цены, заявления) — ОБЯЗАТЕЛЬНО вызови webSearch. Если фактов нет, ставь factCheck.verdict='unverified' и sources=[].
                Источники в factCheck.sources — только реальные ссылки из результатов webSearch (citations); не выдумывай. Если поиск вернул ссылки — ОБЯЗАТЕЛЬНО включи их в factCheck.sources.
                language — ISO-код языка исходного текста.`,
                prompt: `Проанализируй следующий текст:\n\n${text}`,
            });

            return output as AiAnalysisResult;
        } catch (error) {
            this.logger.error('Error analyzing text with xAI (structured)', error);
            return {
                summary: text.slice(0, 100) + '...',
                sentiment: 'unknown',
                keywords: [],
            };
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        this.logger.warn('Embedding generation requested, but not implemented for xAI yet.');
        throw new Error('Embedding generation not implemented for xAI provider');
    }
}
