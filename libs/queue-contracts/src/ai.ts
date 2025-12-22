
export const QUEUE_AI_PROCESSING = 'ai_processing' as const;

export const JOBS_AI = {
    generateText: 'generate_text',
    analyzeText: 'analyze_text',
} as const;

export type AiJobName = (typeof JOBS_AI)[keyof typeof JOBS_AI];

export interface GenerationOptions {
    maxTokens?: number;
    temperature?: number;
    model?: string;
}

export interface GenerateTextPayload {
    prompt: string;
    provider?: string;
    options?: GenerationOptions;
}

export interface AnalyzeTextPayload {
    text: string;
    provider?: string;
}

export interface AiAnalysisResult {
    summary?: string;
    sentiment?: string;
    keywords?: string[];
    [key: string]: any;
}
