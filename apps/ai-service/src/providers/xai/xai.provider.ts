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
            // Using native xAI search capability via searchParameters.
            // This allows the model to access the internet for fact-checking without manual tool management.
            const { output } = await generateText({
                model: this.xai('grok-4-1-fast-reasoning'),
                output: Output.object({
                    schema: z.object({
                        summary: z.string().describe('Краткое содержание текста на русском языке'),
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
                        }).optional().describe('Результаты факт-чекинга'),
                    }),
                }),
                providerOptions: {
                    xai: {
                        searchParameters: { mode: 'auto' },
                    },
                },
                system: `Ты — профессиональный аналитик контента из Telegram. 
                Твоя задача — проводить глубокий анализ сообщений.
                Всегда делай краткое резюме (summary) на РУССКОМ ЯЗЫКЕ, независимо от языка оригинала.
                Извлекай все значимые сущности (имена, компании, тикеры активов).
                Проводи факт-чекинг: оценивай достоверность утверждений.
                ИСПОЛЬЗУЙ ДОСТУП В ИНТЕРНЕТ (Live Search) для проверки сомнительных фактов, свежих новостей или данных, которые требуют уточнения.
                Выявляй потенциальную дезинформацию или манипуляции.`,
                prompt: `Проанализируй следующий текст:\n\n${text}`,
            });

            return output as any as AiAnalysisResult;
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
