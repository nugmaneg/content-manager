/**
 * S3 Storage Service
 *
 * Shared библиотека для работы с S3-совместимым хранилищем.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.getConfig();

    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });

    this.logger.log(
      `S3 client initialized: bucket=${this.bucket}, endpoint=${config.endpoint || 'AWS'}`,
    );
  }

  private getConfig(): S3Config {
    return {
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      bucket: this.configService.get<string>('S3_BUCKET', 'content-manager'),
      accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID', ''),
      secretAccessKey: this.configService.get<string>(
        'S3_SECRET_ACCESS_KEY',
        '',
      ),
      forcePathStyle: this.configService.get<boolean>(
        'S3_FORCE_PATH_STYLE',
        true,
      ),
    };
  }

  /**
   * Загрузить файл в S3
   */
  async upload(
    key: string,
    body: Buffer | Readable,
    options?: UploadOptions,
  ): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        }),
      );

      this.logger.debug(`Uploaded: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload ${key}`, error);
      throw error;
    }
  }

  /**
   * Скачать файл из S3
   */
  async download(key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const stream = response.Body as Readable;
      const chunks: Uint8Array[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to download ${key}`, error);
      throw error;
    }
  }

  /**
   * Удалить файл из S3
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      this.logger.debug(`Deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete ${key}`, error);
      throw error;
    }
  }

  /**
   * Проверить существование файла
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Получить presigned URL для скачивания
   */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Генерация уникального ключа для медиа
   */
  generateMediaKey(
    sourceId: string,
    messageId: string,
    index: number,
    extension: string,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `media/${year}/${month}/${sourceId}/${messageId}_${index}.${extension}`;
  }
}
