import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient } from '../grpc';

export interface ModelSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export interface PromptWithSettings {
  template: string;
  modelSettings: ModelSettings | null;
}

interface CachedPrompt {
  template: string;
  id: string; // Нужно знать ID для инкремента использования
  modelSettings: ModelSettings | null;
  timestamp: number;
}

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);
  private readonly cache = new Map<string, CachedPrompt>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 минут

  constructor(private readonly dbClient: DatabaseGrpcClient) { }

  /**
   * Получить промпт по ключу с кэшированием
   */
  async getPrompt(key: string): Promise<string> {
    const result = await this.getPromptWithSettings(key);
    return result.template;
  }

  /**
   * Получить промпт вместе с настройками модели (model, temperature, etc.)
   * Используется для подстановки модели из БД
   */
  async getPromptWithSettings(key: string): Promise<PromptWithSettings> {
    // Проверка кэша
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.logger.debug(`Cache HIT for prompt: ${key}`);

      // Фоновое обновление счетчика использования
      this.incrementUsage(cached.id).catch((err) =>
        this.logger.error(
          `Failed to increment usage for cached prompt ${key}: ${err.message}`,
        ),
      );

      return {
        template: cached.template,
        modelSettings: cached.modelSettings,
      };
    }

    // Загрузка из gRPC
    this.logger.debug(`Cache MISS for prompt: ${key}, loading from gRPC`);
    const prompt = await this.dbClient.getAiPromptByKey(key);

    if (!prompt || !prompt.is_active) {
      this.logger.warn(`Prompt not found or inactive: ${key}`);
      throw new Error(`Prompt '${key}' not found or inactive`);
    }

    // Парсинг modelSettings
    let modelSettings: ModelSettings | null = null;
    if (prompt.model_settings_json) {
      try {
        modelSettings = JSON.parse(prompt.model_settings_json);
      } catch (e) {
        this.logger.warn(`Failed to parse modelSettings for prompt ${key}`);
      }
    }

    // Обновление usage count
    await this.incrementUsage(prompt.id);

    // Сохранение в кэш
    this.cache.set(key, {
      template: prompt.template,
      id: prompt.id,
      modelSettings,
      timestamp: Date.now(),
    });

    return {
      template: prompt.template,
      modelSettings,
    };
  }

  private async incrementUsage(id: string) {
    try {
      await this.dbClient.incrementAiPromptUsage(id);
    } catch (error) {
      this.logger.error(`Failed to increment usage for prompt ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Рендеринг промпта с подстановкой переменных
   * Поддерживает синтаксис: {{variable}}
   */
  renderPrompt(template: string, variables: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement =
        typeof value === 'string' ? value : JSON.stringify(value);
      rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return rendered;
  }

  /**
   * Инвалидация кэша для конкретного промпта
   */
  invalidateCache(key: string): void {
    this.cache.delete(key);
    this.logger.log(`Cache invalidated for prompt: ${key}`);
  }

  /**
   * Очистка всего кэша
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('All prompt cache cleared');
  }

  /**
   * Получить статистику кэша
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
