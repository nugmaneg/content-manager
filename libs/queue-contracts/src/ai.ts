
export const QUEUE_AI_PROCESSING = 'ai_processing' as const;

export const JOBS_AI = {
    generateText: 'generate_text',
    analyzeText: 'analyze_text',
    generateEmbedding: 'generate_embedding',
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

export interface GenerateEmbeddingPayload {
    text: string;
    provider?: string; // defaults to 'openai'
}

export interface EmbeddingResult {
    embedding: number[];
    model: string;
    dimensions: number;
}

export interface AiAnalysisResult {
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
    keywords: string[];
    entities?: {
        organizations?: string[];
        people?: string[];
        tickers?: string[];
        locations?: string[];
    };
    category?: string;
    language?: string;
    factCheck?: {
        verdict: 'verified' | 'partially_true' | 'false' | 'unverified' | 'opinion';
        score: number;
        explanation: string;
        sources?: string[];
    };
    [key: string]: any;
}

