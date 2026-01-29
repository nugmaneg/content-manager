import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseGrpcClient, AiPromptResponse } from '../../grpc';
import { CreatePromptDto, UpdatePromptDto } from './dto/prompt.dto';

@Injectable()
export class AiPromptsService {
  private readonly logger = new Logger(AiPromptsService.name);

  constructor(private readonly dbClient: DatabaseGrpcClient) {}

  async listPrompts(
    provider?: string,
    category?: string,
    activeOnly?: boolean,
  ) {
    const prompts = await this.dbClient.listAiPrompts({
      provider,
      category,
      activeOnly,
    });
    return prompts.map(this.mapToResponse);
  }

  async getPromptByKey(key: string) {
    const prompt = await this.dbClient.getAiPromptByKey(key);
    if (!prompt) {
      throw new NotFoundException(`Prompt with key '${key}' not found`);
    }
    return this.mapToResponse(prompt);
  }

  async getPromptById(id: string) {
    const prompt = await this.dbClient.getAiPrompt(id);
    if (!prompt) {
      throw new NotFoundException(`Prompt with id '${id}' not found`);
    }
    return this.mapToResponse(prompt);
  }

  async createPrompt(dto: CreatePromptDto, userId?: string) {
    const prompt = await this.dbClient.createAiPrompt({
      key: dto.key,
      name: dto.name,
      description: dto.description,
      template: dto.template,
      provider: dto.provider,
      category: dto.category,
      modelSettings: dto.modelSettings,
      variantGroup: dto.variantGroup,
      variantName: dto.variantName,
      createdById: userId,
    });
    return this.mapToResponse(prompt);
  }

  async updatePrompt(id: string, dto: UpdatePromptDto, userId?: string) {
    try {
      const prompt = await this.dbClient.updateAiPrompt(id, {
        template: dto.template,
        changeNote: dto.changeNote,
        changedBy: userId,
      });
      return this.mapToResponse(prompt);
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        throw new NotFoundException(`Prompt with id '${id}' not found`);
      }
      throw error;
    }
  }

  async toggleActiveStatus(id: string, isActive: boolean) {
    try {
      const prompt = await this.dbClient.toggleAiPrompt(id, isActive);
      return this.mapToResponse(prompt);
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        throw new NotFoundException(`Prompt with id '${id}' not found`);
      }
      throw error;
    }
  }

  async getPromptVersions(id: string) {
    try {
      const result = await this.dbClient.getAiPromptVersions(id);
      return {
        prompt: {
          key: result.prompt_key,
          name: result.prompt_name,
        },
        versions: result.versions.map((v) => ({
          id: v.id,
          promptId: v.prompt_id,
          version: v.version,
          template: v.template,
          changeNote: v.change_note,
          changedBy: v.changed_by,
          createdAt: v.created_at,
        })),
      };
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        throw new NotFoundException(`Prompt with id '${id}' not found`);
      }
      throw error;
    }
  }

  async deletePrompt(id: string) {
    try {
      await this.dbClient.deleteAiPrompt(id);
      return { success: true };
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        throw new NotFoundException(`Prompt with id '${id}' not found`);
      }
      throw error;
    }
  }

  // Map gRPC response (snake_case) to API response (camelCase)
  private mapToResponse(prompt: AiPromptResponse) {
    return {
      id: prompt.id,
      key: prompt.key,
      name: prompt.name,
      description: prompt.description || null,
      template: prompt.template,
      provider: prompt.provider,
      category: prompt.category,
      version: prompt.version,
      isActive: prompt.is_active,
      usageCount: prompt.usage_count || 0,
      lastUsedAt: prompt.last_used_at || null,
      modelSettings: prompt.model_settings_json
        ? JSON.parse(prompt.model_settings_json)
        : null,
      variantGroup: prompt.variant_group || null,
      variantName: prompt.variant_name || null,
      createdById: prompt.created_by_id || null,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
    };
  }
}
