/**
 * Payloads — Payload'ы для очередей
 */

import { ContentInput } from '../analysis/input';
import { MediaAttachment } from '../analysis/media';

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
// ANALYZE CONTENT PAYLOAD
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
