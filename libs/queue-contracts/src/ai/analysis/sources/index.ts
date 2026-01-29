/**
 * Source Metadata — Метаданные источников контента
 */

// ===========================================
// PLATFORMS
// ===========================================

export const PLATFORMS = [
    'telegram',
    'twitter',
    'rss',
    'web',
    'other',
] as const;

export type Platform = (typeof PLATFORMS)[number];

// ===========================================
// SOURCE META
// ===========================================

export interface BaseSourceMeta {
    platform: Platform;
}

export interface TelegramSourceMeta extends BaseSourceMeta {
    platform: 'telegram';
    channelId: string;
    channelName?: string;
    postId: string;
    postDate: string; // ISO date
    authorId?: string;
    authorName?: string;
}

export interface TwitterSourceMeta extends BaseSourceMeta {
    platform: 'twitter';
    userId: string;
    userName?: string;
    tweetId: string;
    tweetDate: string;
}

export interface RssSourceMeta extends BaseSourceMeta {
    platform: 'rss';
    feedUrl: string;
    itemId: string;
    itemDate: string;
}

export interface WebSourceMeta extends BaseSourceMeta {
    platform: 'web';
    url: string;
    scrapedAt: string;
}

export type SourceMeta =
    | TelegramSourceMeta
    | TwitterSourceMeta
    | RssSourceMeta
    | WebSourceMeta
    | BaseSourceMeta;
