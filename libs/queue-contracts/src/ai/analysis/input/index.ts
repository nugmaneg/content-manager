/**
 * Content Input — Входные данные для анализа
 */

import {
    BaseSourceMeta,
    TelegramSourceMeta,
    TwitterSourceMeta,
    RssSourceMeta,
    WebSourceMeta,
} from '../sources';
import { MediaAttachment, BaseMediaAttachment } from '../media';

// ===========================================
// BASE CONTENT INPUT
// ===========================================

export interface BaseContentInput {
    text: string;
    media?: BaseMediaAttachment[];
    urls?: string[]; // извлечённые URL-ы
    source: BaseSourceMeta;
}

// ===========================================
// TELEGRAM
// ===========================================

export interface TelegramContentInput extends BaseContentInput {
    media?: MediaAttachment[];
    source: TelegramSourceMeta;

    // Telegram-specific
    forwardedFrom?: {
        channelId?: string;
        channelName?: string;
        postId?: string;
        originalDate?: string;
    };
    replyToPostId?: string;
}

// ===========================================
// TWITTER
// ===========================================

export interface TwitterContentInput extends BaseContentInput {
    media?: MediaAttachment[];
    source: TwitterSourceMeta;

    // Twitter-specific
    isRetweet?: boolean;
    quotedTweetId?: string;
    inReplyToTweetId?: string;
}

// ===========================================
// RSS
// ===========================================

export interface RssContentInput extends BaseContentInput {
    source: RssSourceMeta;
    title?: string;
    author?: string;
}

// ===========================================
// WEB
// ===========================================

export interface WebContentInput extends BaseContentInput {
    source: WebSourceMeta;
    title?: string;
    author?: string;
}

// ===========================================
// UNION TYPE
// ===========================================

export type ContentInput =
    | TelegramContentInput
    | TwitterContentInput
    | RssContentInput
    | WebContentInput
    | BaseContentInput;
