
import { GenerationOptions, AiAnalysisResult } from '@queue-contracts/ai';

export { GenerationOptions, AiAnalysisResult };

export interface AiProvider {
    generateText(prompt: string, options?: GenerationOptions): Promise<string>;
    analyzeText(text: string): Promise<AiAnalysisResult>;
    generateEmbedding(text: string): Promise<number[]>;
}
