import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, embed, Output } from 'ai';
import { z } from 'zod';
import { AiProvider, AiAnalysisResult, GenerationOptions } from '../../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
    private readonly logger = new Logger(OpenAiProvider.name);
    private readonly openai;
    private readonly embeddingModel = 'text-embedding-3-small';

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY is not set');
        }

        this.openai = createOpenAI({
            apiKey: apiKey,
        });
    }

    async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
        try {
            const { text } = await generateText({
                model: this.openai(options?.model || 'gpt-4o-mini'),
                prompt: prompt,
                maxOutputTokens: options?.maxTokens,
                temperature: options?.temperature,
            });

            return text;
        } catch (error) {
            this.logger.error('Error generating text with OpenAI', error);
            throw error;
        }
    }

    async analyzeText(text: string): Promise<AiAnalysisResult> {
        try {
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
            });

            const { output } = await generateText({
                model: this.openai('gpt-4o-mini'),
                output: Output.object({
                    schema: analysisSchema,
                }),
                system: `Ты — аналитик Telegram. Всегда возвращай ТОЛЬКО JSON по схеме, без Markdown и лишних ключей.
                Делай краткое резюме (summary) на русском, не более 3 предложений, независимо от языка оригинала.
                Извлекай сущности (имена, компании, тикеры, локации), keywords — 5-10 слов, строчные.
                language — ISO-код языка исходного текста.`,
                prompt: `Проанализируй следующий текст:\n\n${text}`,
            });

            return output as AiAnalysisResult;
        } catch (error) {
            this.logger.error('Error analyzing text with OpenAI (structured)', error);
            return {
                summary: text.slice(0, 100) + '...',
                sentiment: 'unknown',
                keywords: [],
            };
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            this.logger.debug(`Generating embedding for text (${text.length} chars)`);

            const { embedding } = await embed({
                model: this.openai.embedding(this.embeddingModel),
                value: text,
            });

            this.logger.debug(`Generated embedding with ${embedding.length} dimensions`);
            return embedding;
        } catch (error) {
            this.logger.error('Error generating embedding with OpenAI', error);
            throw error;
        }
    }
}
