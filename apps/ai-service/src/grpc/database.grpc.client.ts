import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Observable, firstValueFrom } from 'rxjs';

// AI Prompt interfaces
interface AiPromptResponse {
  id: string;
  key: string;
  name: string;
  description: string;
  template: string;
  provider: string;
  category: string;
  version: number;
  is_active: boolean;
  usage_count: number;
  last_used_at: string;
  model_settings_json: string;
  variant_group: string;
  variant_name: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

interface AiPromptVersionResponse {
  id: string;
  prompt_id: string;
  version: number;
  template: string;
  change_note: string;
  changed_by: string;
  created_at: string;
}

interface ListAiPromptsResponse {
  prompts: AiPromptResponse[];
}

interface AiPromptVersionsResponse {
  prompt_key: string;
  prompt_name: string;
  versions: AiPromptVersionResponse[];
}

// Only AI Prompt methods needed for now
interface DatabaseService {
  // AI Prompt methods
  listAiPrompts(data: {
    provider?: string;
    category?: string;
    active_only?: boolean;
  }): Observable<ListAiPromptsResponse>;
  getAiPrompt(data: { id: string }): Observable<AiPromptResponse>;
  getAiPromptByKey(data: { key: string }): Observable<AiPromptResponse>;
  updateAiPrompt(data: {
    id: string;
    template: string;
    change_note?: string;
    changed_by?: string;
  }): Observable<AiPromptResponse>;
  toggleAiPrompt(data: {
    id: string;
    is_active: boolean;
  }): Observable<AiPromptResponse>;
  incrementAiPromptUsage(data: {
    id: string;
  }): Observable<Record<string, never>>;
}

export { AiPromptResponse };

@Injectable()
export class DatabaseGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(DatabaseGrpcClient.name);
  private databaseService: DatabaseService;
  private client: ClientGrpc;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const grpcUrl =
      this.configService.get<string>('DATABASE_GRPC_URL') || 'localhost:50051';

    // Create gRPC client dynamically
    const { ClientProxyFactory } = require('@nestjs/microservices');

    // /app/libs/grpc-contracts/database.proto in Docker
    const protoPath = join(process.cwd(), 'libs/grpc-contracts/database.proto');

    this.client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'database',
        protoPath,
        url: grpcUrl,
        loader: {
          keepCase: true,
          defaults: true,
          arrays: true,
          objects: true,
        },
      },
    }) as ClientGrpc;

    this.databaseService =
      this.client.getService<DatabaseService>('DatabaseService');
    this.logger.log(`Connected to database gRPC service at ${grpcUrl}`);
  }

  // ===================================
  // AI PROMPT METHODS
  // ===================================

  async listAiPrompts(params?: {
    provider?: string;
    category?: string;
    activeOnly?: boolean;
  }): Promise<AiPromptResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.listAiPrompts({
        provider: params?.provider,
        category: params?.category,
        active_only: params?.activeOnly,
      }),
    );
    return result.prompts || [];
  }

  async getAiPrompt(id: string): Promise<AiPromptResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getAiPrompt({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async getAiPromptByKey(key: string): Promise<AiPromptResponse | null> {
    try {
      return await firstValueFrom(
        this.databaseService.getAiPromptByKey({ key }),
      );
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async incrementAiPromptUsage(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.incrementAiPromptUsage({ id }));
  }
}
