
import {
    QUEUE_AI_PROCESSING as DEFAULT_QUEUE_AI_PROCESSING,
    JOBS_AI,
    AiJobName,
    GenerateTextPayload,
    AnalyzeTextPayload,
    AiAnalysisResult,
    GenerationOptions,
} from '@queue-contracts/ai';

export const QUEUE_AI_PROCESSING =
    process.env.AI_PROCESSING_QUEUE ?? DEFAULT_QUEUE_AI_PROCESSING;

export { JOBS_AI };

export type {
    AiJobName,
    GenerateTextPayload,
    AnalyzeTextPayload,
    AiAnalysisResult,
    GenerationOptions,
};
