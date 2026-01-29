/**
 * Media Types — Типы для медиа-контента
 */

// ===========================================
// MEDIA TYPES
// ===========================================

export const MEDIA_TYPES = ['photo', 'audio', 'video', 'document'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

// ===========================================
// MEDIA ATTACHMENTS
// ===========================================

export interface BaseMediaAttachment {
    type: MediaType;
    filePath: string; // путь в S3
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
}

export interface PhotoAttachment extends BaseMediaAttachment {
    type: 'photo';
    width?: number;
    height?: number;
}

export interface VideoAttachment extends BaseMediaAttachment {
    type: 'video';
    width?: number;
    height?: number;
    duration?: number; // секунды
    thumbnail?: string; // путь к превью в S3
}

export interface AudioAttachment extends BaseMediaAttachment {
    type: 'audio';
    duration?: number; // секунды
}

export interface DocumentAttachment extends BaseMediaAttachment {
    type: 'document';
}

export type MediaAttachment =
    | PhotoAttachment
    | VideoAttachment
    | AudioAttachment
    | DocumentAttachment;

// ===========================================
// MEDIA ANALYSIS RESULT
// ===========================================

export const MEDIA_RELEVANCE = [
    'primary',
    'supporting',
    'decorative',
    'unrelated',
] as const;

export type MediaRelevance = (typeof MEDIA_RELEVANCE)[number];

export interface DetectedFace {
    name?: string; // если известная личность
    confidence: number; // 0-1
}

export interface MediaAnalysisResult {
    mediaIndex: number;
    type: MediaType;

    // Описание
    description: string;

    // OCR (для фото)
    extractedText?: string;

    // Детекция
    detectedFaces?: DetectedFace[];
    watermarks?: string[];
    hasForbiddenContent: boolean;
    forbiddenContentType?: string;

    // Связь с контентом
    relevanceToText: MediaRelevance;
    sentiment?: 'positive' | 'neutral' | 'negative';
}
