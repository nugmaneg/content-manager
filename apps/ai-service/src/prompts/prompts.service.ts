import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * PromptsService — Управление промптами через файловую систему
 *
 * Загружает промпты из .md файлов вместо хардкода в коде.
 * Поддерживает Docker volume mapping для изменения промптов без пересборки.
 */
@Injectable()
export class PromptsService implements OnModuleInit {
  private readonly logger = new Logger(PromptsService.name);
  private readonly promptsCache = new Map<string, string>();
  private readonly basePath: string;

  constructor() {
    // В продакшене: /app/prompts/templates (Docker volume)
    // В разработке: ./src/prompts/templates
    this.basePath =
      process.env.PROMPTS_PATH ||
      path.join(__dirname, 'templates');

    this.logger.log(`Prompts base path: ${this.basePath}`);
  }

  async onModuleInit() {
    // Загрузить все промпты при старте
    await this.loadAllPrompts();
  }

  /**
   * Загрузить все промпты из директории
   */
  private async loadAllPrompts() {
    try {
      const files = await this.findAllMarkdownFiles(this.basePath);

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const key = this.getPromptKey(file);
          this.promptsCache.set(key, content);
          this.logger.log(`✅ Loaded prompt: ${key}`);
        } catch (error) {
          this.logger.error(
            `❌ Failed to load prompt ${file}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `📋 Loaded ${this.promptsCache.size} prompts from ${this.basePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load prompts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Найти все .md файлы рекурсивно
   */
  private async findAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findAllMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Cannot read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return files;
  }

  /**
   * Получить ключ промпта из пути к файлу
   * Например: /path/to/templates/segmentation/segment-content.md -> segmentation/segment-content
   */
  private getPromptKey(filePath: string): string {
    const relativePath = path.relative(this.basePath, filePath);
    // Убираем расширение .md
    return relativePath.replace(/\.md$/, '');
  }

  /**
   * Получить промпт по категории и имени
   *
   * @param category - Категория промпта (segmentation, analysis, fact-check)
   * @param name - Имя файла без расширения
   * @returns Содержимое промпта
   */
  async getPrompt(
    category: 'segmentation' | 'analysis' | 'fact-check',
    name: string,
  ): Promise<string> {
    const key = `${category}/${name}`;

    // Проверить кэш
    if (this.promptsCache.has(key)) {
      return this.promptsCache.get(key)!;
    }

    // Загрузить из файла (если не в кэше)
    try {
      const filePath = path.join(this.basePath, `${key}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      this.promptsCache.set(key, content);

      this.logger.log(`📄 Loaded prompt on demand: ${key}`);

      return content;
    } catch (error) {
      this.logger.error(
        `❌ Failed to load prompt ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Prompt not found: ${key}`);
    }
  }

  /**
   * Перезагрузить промпт (для hot-reload в development)
   *
   * @param category - Категория промпта
   * @param name - Имя файла без расширения
   */
  async reloadPrompt(
    category: 'segmentation' | 'analysis' | 'fact-check',
    name: string,
  ) {
    const key = `${category}/${name}`;
    const filePath = path.join(this.basePath, `${key}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.promptsCache.set(key, content);
      this.logger.log(`🔄 Reloaded prompt: ${key}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to reload prompt ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Failed to reload prompt: ${key}`);
    }
  }

  /**
   * Получить список всех загруженных промптов
   */
  getLoadedPrompts(): string[] {
    return Array.from(this.promptsCache.keys());
  }
}
