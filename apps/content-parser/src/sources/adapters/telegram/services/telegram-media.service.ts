import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '@storage';
import { Api, TelegramClient } from 'telegram';

export interface MediaUploadResult {
  key: string;
  mimeType: string;
  size: number;
  type: 'photo' | 'video' | 'audio' | 'document';
  width?: number;
  height?: number;
  duration?: number;
}

@Injectable()
export class TelegramMediaService {
  private readonly logger = new Logger(TelegramMediaService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Скачать и загрузить медиа из Telegram сообщения в S3
   */
  async uploadMediaFromMessage(
    client: TelegramClient,
    message: Api.Message,
    sourceId: string,
  ): Promise<MediaUploadResult[]> {
    const results: MediaUploadResult[] = [];

    if (!message.media) {
      return results;
    }

    const messageId = message.id.toString();

    // Фото
    if (message.media instanceof Api.MessageMediaPhoto) {
      const result = await this.uploadPhoto(
        client,
        message,
        sourceId,
        messageId,
        0,
      );
      if (result) results.push(result);
    }

    // Документ (включая видео, аудио, файлы)
    if (message.media instanceof Api.MessageMediaDocument) {
      const result = await this.uploadDocument(
        client,
        message,
        sourceId,
        messageId,
        0,
      );
      if (result) results.push(result);
    }

    return results;
  }

  private async uploadPhoto(
    client: TelegramClient,
    message: Api.Message,
    sourceId: string,
    messageId: string,
    index: number,
  ): Promise<MediaUploadResult | null> {
    try {
      const buffer = (await client.downloadMedia(message)) as Buffer;
      if (!buffer) return null;

      const key = this.s3Service.generateMediaKey(
        sourceId,
        messageId,
        index,
        'jpg',
      );

      await this.s3Service.upload(key, buffer, {
        contentType: 'image/jpeg',
        metadata: {
          sourceId,
          messageId,
          type: 'photo',
        },
      });

      // Получаем размеры фото если доступны
      let width: number | undefined;
      let height: number | undefined;
      const photo = (message.media as Api.MessageMediaPhoto).photo;
      if (photo instanceof Api.Photo && photo.sizes.length > 0) {
        const largest = photo.sizes[photo.sizes.length - 1];
        if ('w' in largest && 'h' in largest) {
          width = largest.w;
          height = largest.h;
        }
      }

      this.logger.debug(`Uploaded photo: ${key} (${buffer.length} bytes)`);

      return {
        key,
        mimeType: 'image/jpeg',
        size: buffer.length,
        type: 'photo',
        width,
        height,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload photo from message ${messageId}`,
        error,
      );
      return null;
    }
  }

  private async uploadDocument(
    client: TelegramClient,
    message: Api.Message,
    sourceId: string,
    messageId: string,
    index: number,
  ): Promise<MediaUploadResult | null> {
    try {
      const media = message.media as Api.MessageMediaDocument;
      const doc = media.document;

      if (!(doc instanceof Api.Document)) return null;

      const buffer = (await client.downloadMedia(message)) as Buffer;
      if (!buffer) return null;

      // Определяем тип
      const mimeType = doc.mimeType || 'application/octet-stream';
      let type: 'video' | 'audio' | 'document' = 'document';
      let extension = 'bin';

      if (mimeType.startsWith('video/')) {
        type = 'video';
        extension = mimeType.includes('mp4') ? 'mp4' : 'video';
      } else if (mimeType.startsWith('audio/')) {
        type = 'audio';
        extension = mimeType.includes('mp3')
          ? 'mp3'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'audio';
      } else if (mimeType === 'application/pdf') {
        extension = 'pdf';
      }

      const key = this.s3Service.generateMediaKey(
        sourceId,
        messageId,
        index,
        extension,
      );

      await this.s3Service.upload(key, buffer, {
        contentType: mimeType,
        metadata: {
          sourceId,
          messageId,
          type,
        },
      });

      // Получаем duration для video/audio
      let duration: number | undefined;
      for (const attr of doc.attributes) {
        if (attr instanceof Api.DocumentAttributeVideo) {
          duration = attr.duration;
        } else if (attr instanceof Api.DocumentAttributeAudio) {
          duration = attr.duration;
        }
      }

      this.logger.debug(
        `Uploaded ${type}: ${key} (${buffer.length} bytes, ${mimeType})`,
      );

      return {
        key,
        mimeType,
        size: buffer.length,
        type,
        duration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload document from message ${messageId}`,
        error,
      );
      return null;
    }
  }
}
