
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
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
        // Basic analysis prompt for xAI
        const prompt = `Analyze the following text. Provide a summary, detect the sentiment, and extract key keywords. Return the result in JSON format with keys: "summary", "sentiment", "keywords".
    
    Text:
    ${text}`;

        try {
            // Reuse generateText which now uses the AI SDK
            const response = await this.generateText(prompt, { model: 'grok-beta', temperature: 0.3 });

            // Attempt to parse JSON from the response
            // Grok might return markdown code blocks, so we need to strip them
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            this.logger.error('Error analyzing text with xAI', error);
            return {
                summary: 'Error analyzing text',
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
