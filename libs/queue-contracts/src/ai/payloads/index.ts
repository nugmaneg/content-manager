/**
 * Payloads — Payload'ы для очередей
 */

import { ContentInput } from '../analysis/input';
import { MediaAttachment } from '../analysis/media';
import { ContentType } from '../constants';
import { ContentUnitAnalysis } from '../analysis/output';
import { GenerationOptions } from '../providers';

// ===========================================
// RAW CONTENT STATUS
// ===========================================

export const RAW_CONTENT_STATUS = [
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
] as const;

export type RawContentStatus = (typeof RAW_CONTENT_STATUS)[number];

// ===========================================
// CONTENT UNIT BASIC (результат Stage 1)
// ===========================================

export interface ContentUnitBasic {
    unitIndex: number;
    originalText: string;
    contentType: ContentType;
    qualityScore: number;
    qualityReasoning: string;
    language: string;
}

// ===========================================
// CONTENT SEGMENTATION RESULT (Stage 1)
// ===========================================

export interface ContentSegmentationResult {
    units: ContentUnitBasic[];
}

// ===========================================
// SEGMENT CONTENT PAYLOAD (Stage 1)
// ===========================================

export interface SegmentContentPayload {
    rawContentId: string;
    input: ContentInput;
    provider?: string;
    options?: GenerationOptions;
}

// ===========================================
// ANALYZE CONTENT UNIT PAYLOAD (Stage 2)
// ===========================================

export interface AnalyzeContentUnitPayload {
    unitId: string; // ID из БД
    unit: ContentUnitBasic;
    provider?: string;
    options?: GenerationOptions;
}

// ===========================================
// FACT CHECK CONTENT PAYLOAD (Stage 3)
// ===========================================

export interface FactCheckContentPayload {
    units: ContentUnitAnalysis[];
    provider?: string;
    options?: GenerationOptions;
}

// ===========================================
// FACT CHECK CONTENT RESULT (Stage 3)
// ===========================================

export interface FactCheckContentResult {
    units: ContentUnitAnalysis[]; // with factCheckResult populated
    totalCost?: number;
    totalDurationMs: number;
}

// ===========================================
// ANALYZE CONTENT PAYLOAD (DEPRECATED - будет удален)
// ===========================================

export interface AnalyzeContentPayload {
    rawContentId: string;
    input: ContentInput;
    options?: {
        skipMediaAnalysis?: boolean;
        skipFactCheck?: boolean;
    };
}

// ===========================================
// ANALYZE MEDIA PAYLOAD
// ===========================================

export interface AnalyzeMediaPayload {
    rawContentId: string;
    media: MediaAttachment[];
}

// ===========================================
// AI JOB PAYLOAD UNION TYPE
// ===========================================

export type AiJobPayload =
    | SegmentContentPayload
    | AnalyzeContentUnitPayload
    | FactCheckContentPayload
    | AnalyzeContentPayload // deprecated, will be removed
    | AnalyzeMediaPayload;
