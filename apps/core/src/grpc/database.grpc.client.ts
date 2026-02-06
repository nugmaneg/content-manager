import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Observable, firstValueFrom } from 'rxjs';

// User interfaces - fields must match proto definition (snake_case)
interface UserResponse {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_active: boolean;
  role: string;
  telegram_id: string;
  telegram_username: string;
  avatar_url: string;
  refresh_token_hash: string;
  created_at: string;
  updated_at: string;
}

interface GetUserByIdRequest {
  id: string;
}

interface GetUserByEmailRequest {
  email: string;
}

interface CreateUserRequest {
  email: string;
  name?: string;
  password_hash: string;
  role?: string;
}

interface UpdateUserRefreshTokenRequest {
  id: string;
  refresh_token_hash: string;
}

interface CountUsersResponse {
  count: number;
}

// Content interfaces
interface ContentResponse {
  id: string;
  external_id: string;
  text: string;
  source_id: string;
  received_via_id: string;
  qdrant_id: string;
  is_vectorized: boolean;
  embedding_model: string;
  created_at: string;
  updated_at: string;
  raw_data_json: string;
  ai_analysis_json: string;
  raw_content?: RawContentResponse;
  content_units?: ContentUnitResponse[];
}

interface ListContentResponse {
  items: ContentResponse[];
  total: number;
}

// Workspace interfaces
interface WorkspaceResponse {
  id: string;
  name: string;
  owner_id: string;
  settings_json: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceUserResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  user_email: string;
  user_name: string;
  created_at: string;
}

interface ListWorkspacesResponse {
  workspaces: WorkspaceResponse[];
}

interface ListWorkspaceUsersResponse {
  users: WorkspaceUserResponse[];
}

// Source interfaces
interface SourceResponse {
  id: string;
  type: string;
  external_id: string;
  name: string;
  description: string;
  avatar_url: string;
  url: string;
  is_active: boolean;
  language: string;
  metadata_json: string;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

interface ListSourcesResponse {
  items: SourceResponse[];
  total: number;
}

// WorkspaceDonor interfaces
interface WorkspaceDonorResponse {
  id: string;
  workspace_id: string;
  source_id: string;
  is_active: boolean;
  settings_json: string;
  created_at: string;
  source_type: string;
  source_external_id: string;
  source_name: string;
}

interface ListWorkspaceDonorsResponse {
  donors: WorkspaceDonorResponse[];
}

// Target interfaces
interface TargetResponse {
  id: string;
  workspace_id: string;
  type: string;
  external_id: string;
  name: string;
  description: string;
  language: string;
  timezone: string;
  max_posts_per_day: number;
  min_post_interval: number;
  settings_json: string;
  work_schedule_json: string;
  account_id: string;
  is_active: boolean;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface ListTargetsResponse {
  targets: TargetResponse[];
  total: number;
}

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

// RawContent interfaces
interface RawContentResponse {
  id: string;
  source_id: string;
  external_id: string;
  text: string;
  media_json: string;
  urls_json: string;
  source_meta_json: string;
  status: string;
  received_at: string;
  processed_at: string;
  created_at: string;

  // State Machine fields
  retry_count?: number;
  processing_metadata?: string;
  state_updated_at?: string;

  content_units?: ContentUnitResponse[];
}

interface ListPendingRawContentResponse {
  items: RawContentResponse[];
  total: number;
}

interface ListRawContentResponse {
  items: RawContentResponse[];
  total: number;
}

interface CheckRawContentExistsRequest {
  source_id: string;
  external_ids: string[];
}

interface CheckRawContentExistsResponse {
  existing_external_ids: string[];
}

// ContentUnit interfaces
interface ContentUnitResponse {
  id: string;
  raw_content_id: string;
  unit_index: number;
  quality_score: number;
  quality_reasoning: string;
  original_text: string;
  content_type: string;
  categories_json: string;
  summary: string;
  sentiment: string;
  keywords_json: string;
  language: string;
  entities_json: string;
  linked_media_indexes_json: string;
  needs_fact_check: boolean;
  fact_check_hint_json: string;
  fact_check_result_json: string;
  qdrant_id: string;
  embedding_model: string;
  topic_id: string;

  // State Machine fields
  status?: string;
  error_message?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

interface CreateContentUnitRequest {
  raw_content_id: string;
  unit_index: number;
  quality_score: number;
  quality_reasoning: string;
  original_text: string;
  content_type: string;
  categories_json?: string;
  summary: string;
  sentiment: string;
  keywords_json?: string;
  language: string;
  entities_json?: string;
  linked_media_indexes_json?: string;
  needs_fact_check: boolean;
  fact_check_hint_json?: string;
}

interface ListContentUnitsResponse {
  items: ContentUnitResponse[];
  total: number;
}

// Topic interfaces
interface TopicResponse {
  id: string;
  type: string;
  title: string;
  summary: string;
  language: string;
  embedding_model: string;
  qdrant_id: string;
  category_id: string;
  version: number;
  relevance_score: number;
  is_expired: boolean;
  fact_check_status: string;
  fact_check_result_json: string;
  fact_checked_at: string;
  created_at: string;
  updated_at: string;
}

interface ListTopicsResponse {
  topics: TopicResponse[];
  total: number;
}

interface SimilarUnitResult {
  unit_id: string;
  topic_id: string;
  score: number;
}

interface DatabaseService {
  // User methods
  getUserById(data: GetUserByIdRequest): Observable<UserResponse>;
  getUserByEmail(data: GetUserByEmailRequest): Observable<UserResponse>;
  createUser(data: CreateUserRequest): Observable<UserResponse>;
  updateUserRefreshToken(
    data: UpdateUserRefreshTokenRequest,
  ): Observable<UserResponse>;
  countUsers(data: Record<string, never>): Observable<CountUsersResponse>;

  // Content methods
  getContent(data: { id: string }): Observable<ContentResponse>;
  listContent(data: {
    limit?: number;
    offset?: number;
    source_id?: string;
    status?: string;
  }): Observable<ListContentResponse>;
  createContent(data: {
    external_id: string;
    source_id: string;
    text?: string;
    raw_data_json?: string;
    received_via_id?: string;
    source_date?: string;
  }): Observable<ContentResponse>;
  updateContent(data: {
    id: string;
    text?: string;
    is_vectorized?: boolean;
    qdrant_id?: string;
    embedding_model?: string;
    ai_analysis_json?: string;
    status?: string;
  }): Observable<ContentResponse>;
  getLastContentForSource(data: {
    source_id: string;
  }): Observable<ContentResponse>;
  upsertContentVector(data: {
    content_id: string;
    vector: number[];
    summary?: string;
    category?: string;
    language?: string;
  }): Observable<{ qdrant_id: string; success: boolean }>;

  // Workspace methods
  getWorkspace(data: { id: string }): Observable<WorkspaceResponse>;
  listWorkspaces(data: { user_id: string }): Observable<ListWorkspacesResponse>;
  createWorkspace(data: {
    name: string;
    owner_id: string;
    settings_json?: string;
  }): Observable<WorkspaceResponse>;
  updateWorkspace(data: {
    id: string;
    name?: string;
    settings_json?: string;
  }): Observable<WorkspaceResponse>;
  deleteWorkspace(data: { id: string }): Observable<Record<string, never>>;
  addWorkspaceUser(data: {
    workspace_id: string;
    user_id: string;
    role: string;
  }): Observable<WorkspaceUserResponse>;
  removeWorkspaceUser(data: {
    workspace_id: string;
    user_id: string;
  }): Observable<Record<string, never>>;
  listWorkspaceUsers(data: {
    workspace_id: string;
  }): Observable<ListWorkspaceUsersResponse>;

  // Source methods
  getSource(data: { id: string }): Observable<SourceResponse>;
  getSourceByExternalId(data: {
    type: string;
    external_id: string;
  }): Observable<SourceResponse>;
  listSources(data: {
    limit?: number;
    offset?: number;
    type?: string;
    active_only?: boolean;
  }): Observable<ListSourcesResponse>;
  createSource(data: {
    type: string;
    external_id: string;
    name?: string;
    description?: string;
    avatar_url?: string;
    url?: string;
    language?: string;
    metadata_json?: string;
  }): Observable<SourceResponse>;
  updateSource(data: {
    id: string;
    name?: string;
    description?: string;
    avatar_url?: string;
    url?: string;
    language?: string;
    metadata_json?: string;
    last_sync_at?: string;
  }): Observable<SourceResponse>;
  setSourceActive(data: {
    id: string;
    is_active: boolean;
  }): Observable<SourceResponse>;
  deleteSource(data: { id: string }): Observable<Record<string, never>>;

  // WorkspaceDonor methods
  addWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
    settings_json?: string;
  }): Observable<WorkspaceDonorResponse>;
  removeWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
  }): Observable<Record<string, never>>;
  listWorkspaceDonors(data: {
    workspace_id: string;
    active_only?: boolean;
  }): Observable<ListWorkspaceDonorsResponse>;
  updateWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
    is_active?: boolean;
    settings_json?: string;
  }): Observable<WorkspaceDonorResponse>;

  // Target methods
  getTarget(data: { id: string }): Observable<TargetResponse>;
  listTargets(data: {
    workspace_id: string;
    active_only?: boolean;
    type?: string;
  }): Observable<ListTargetsResponse>;
  createTarget(data: {
    workspace_id: string;
    type: string;
    external_id: string;
    name?: string;
    description?: string;
    language?: string;
    timezone?: string;
    max_posts_per_day?: number;
    min_post_interval?: number;
    settings_json?: string;
    work_schedule_json?: string;
    account_id?: string;
  }): Observable<TargetResponse>;
  updateTarget(data: {
    id: string;
    name?: string;
    description?: string;
    language?: string;
    timezone?: string;
    max_posts_per_day?: number;
    min_post_interval?: number;
    settings_json?: string;
    work_schedule_json?: string;
    account_id?: string;
    is_active?: boolean;
    metadata_json?: string;
  }): Observable<TargetResponse>;
  deleteTarget(data: { id: string }): Observable<Record<string, never>>;

  // AI Prompt methods
  listAiPrompts(data: {
    provider?: string;
    category?: string;
    active_only?: boolean;
  }): Observable<ListAiPromptsResponse>;
  getAiPrompt(data: { id: string }): Observable<AiPromptResponse>;
  getAiPromptByKey(data: { key: string }): Observable<AiPromptResponse>;
  createAiPrompt(data: {
    key: string;
    name: string;
    description?: string;
    template: string;
    provider: string;
    category: string;
    model_settings_json?: string;
    variant_group?: string;
    variant_name?: string;
    created_by_id?: string;
  }): Observable<AiPromptResponse>;
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
  deleteAiPrompt(data: { id: string }): Observable<Record<string, never>>;
  getAiPromptVersions(data: {
    id: string;
  }): Observable<AiPromptVersionsResponse>;
  incrementAiPromptUsage(data: {
    id: string;
  }): Observable<Record<string, never>>;

  // RawContent methods
  createRawContent(data: {
    source_id: string;
    external_id: string;
    text: string;
    media_json?: string;
    urls_json?: string;
    source_meta_json?: string;
    received_at?: string;
  }): Observable<RawContentResponse>;
  getRawContent(data: { id: string }): Observable<RawContentResponse>;
  updateRawContentStatus(data: {
    id: string;
    status: string;
    processed_at?: string;
  }): Observable<RawContentResponse>;
  listPendingRawContent(data: {
    limit?: number;
  }): Observable<ListPendingRawContentResponse>;
  listRawContent(data: {
    limit?: number;
    offset?: number;
    status?: string;
    source_id?: string;
  }): Observable<ListRawContentResponse>;
  checkRawContentExists(
    data: CheckRawContentExistsRequest,
  ): Observable<CheckRawContentExistsResponse>;

  // ContentUnit methods
  createContentUnit(data: CreateContentUnitRequest): Observable<ContentUnitResponse>;
  createContentUnits(data: {
    units: CreateContentUnitRequest[];
  }): Observable<{ units: ContentUnitResponse[] }>;
  getContentUnit(data: { id: string }): Observable<ContentUnitResponse>;
  listContentUnits(data: {
    raw_content_id?: string;
    min_quality_score?: number;
    limit?: number;
    offset?: number;
  }): Observable<ListContentUnitsResponse>;
  updateContentUnitVector(data: {
    id: string;
    qdrant_id: string;
    embedding_model: string;
  }): Observable<ContentUnitResponse>;
  updateContentUnitTopic(data: {
    id: string;
    topic_id: string;
  }): Observable<ContentUnitResponse>;
  upsertContentUnitVector(data: {
    unit_id: string;
    vector: number[];
    summary?: string;
    content_type?: string;
    language?: string;
  }): Observable<{ qdrant_id: string; success: boolean }>;
  searchSimilarUnits(data: {
    qdrant_id: string;
    limit?: number;
    min_score?: number;
  }): Observable<{ units: SimilarUnitResult[] }>;
  updateContentUnitAnalysis(data: {
    id: string;
    summary?: string;
    entities_json?: string;
    keywords_json?: string;
    sentiment?: string;
    needs_fact_check?: boolean;
    fact_check_hint_json?: string;
  }): Observable<ContentUnitResponse>;
  updateContentUnitFactCheck(data: {
    id: string;
    fact_check_result_json: string;
  }): Observable<ContentUnitResponse>;
  updateContentUnitsFactCheck(data: {
    updates: Array<{
      id: string;
      fact_check_result_json: string;
    }>;
  }): Observable<{ units: ContentUnitResponse[] }>;

  // State Machine methods (новые для идемпотентности)
  getContentUnitsByRawContentId(data: {
    raw_content_id: string;
  }): Observable<{ units: ContentUnitResponse[] }>;
  updateContentUnitStatus(data: {
    id: string;
    status: string;
    processed_at?: string;
    error_message?: string;
  }): Observable<ContentUnitResponse>;

  searchSimilarTopics(data: {
    vector: number[];
    limit?: number;
    min_score?: number;
  }): Observable<{ topics: Array<{ topic_id: string; qdrant_id: string; score: number }> }>;
  getVectorByQdrantId(data: {
    collection_name: string;
    qdrant_id: string;
  }): Observable<{ vector: number[] }>;

  // Topic methods
  getTopic(data: { id: string }): Observable<TopicResponse>;
  listTopics(data: {
    limit?: number;
    offset?: number;
    type?: string;
    category_id?: string;
    only_active?: boolean;
  }): Observable<ListTopicsResponse>;
  createTopic(data: {
    type: string;
    title: string;
    summary?: string;
    language?: string;
    category_id?: string;
    embedding_model?: string;
    qdrant_id?: string;
  }): Observable<TopicResponse>;
  updateTopic(data: {
    id: string;
    title?: string;
    summary?: string;
    version?: number;
    relevance_score?: number;
    is_expired?: boolean;
    embedding_model?: string;
    qdrant_id?: string;
    fact_check_status?: string;
    fact_check_result_json?: string;
    fact_checked_at?: string;
  }): Observable<TopicResponse>;
}

export {
  WorkspaceResponse,
  WorkspaceUserResponse,
  ListWorkspacesResponse,
  ListWorkspaceUsersResponse,
  SourceResponse,
  ListSourcesResponse,
  WorkspaceDonorResponse,
  ListWorkspaceDonorsResponse,
  TargetResponse,
  ListTargetsResponse,
  ContentResponse,
  ListContentResponse,
  AiPromptResponse,
  AiPromptVersionResponse,
  ListAiPromptsResponse,
  AiPromptVersionsResponse,
  // New exports for content pipeline
  RawContentResponse,
  ListPendingRawContentResponse,
  ListRawContentResponse,
  ContentUnitResponse,
  CreateContentUnitRequest,
  ListContentUnitsResponse,
  TopicResponse,
  ListTopicsResponse,
  SimilarUnitResult,
};

@Injectable()
export class DatabaseGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(DatabaseGrpcClient.name);
  private databaseService: DatabaseService;
  private client: ClientGrpc;

  constructor(private configService: ConfigService) { }

  onModuleInit() {
    const grpcUrl =
      this.configService.get<string>('DATABASE_GRPC_URL') || 'localhost:50051';

    // Create gRPC client dynamically
    const { ClientProxyFactory } = require('@nestjs/microservices');

    // Proto path works in both local dev and Docker
    // In Docker: /app/libs/grpc-contracts/database.proto
    // In local: /path/to/project/libs/grpc-contracts/database.proto
    const protoPath = join(process.cwd(), 'libs/grpc-contracts/database.proto');

    this.client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'database',
        protoPath,
        url: grpcUrl,
        loader: {
          keepCase: true, // Keep snake_case from proto
          defaults: true, // Include default values (false, 0, "")
          arrays: true, // Always return arrays
          objects: true, // Always return objects
        },
      },
    }) as ClientGrpc;

    this.databaseService =
      this.client.getService<DatabaseService>('DatabaseService');
    this.logger.log(`Connected to database gRPC service at ${grpcUrl}`);
  }

  async getUserById(id: string): Promise<UserResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getUserById({ id }));
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        return null;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<UserResponse | null> {
    try {
      return await firstValueFrom(
        this.databaseService.getUserByEmail({ email }),
      );
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        return null;
      }
      throw error;
    }
  }

  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    return await firstValueFrom(this.databaseService.createUser(data));
  }

  async updateUserRefreshToken(
    id: string,
    refreshTokenHash: string,
  ): Promise<UserResponse> {
    return await firstValueFrom(
      this.databaseService.updateUserRefreshToken({
        id,
        refresh_token_hash: refreshTokenHash,
      }),
    );
  }

  async countUsers(): Promise<number> {
    const result = await firstValueFrom(this.databaseService.countUsers({}));
    return result.count;
  }

  // ===================================
  // CONTENT METHODS
  // ===================================

  async getContent(id: string): Promise<ContentResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getContent({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listContent(params?: {
    limit?: number;
    offset?: number;
    sourceId?: string;
    status?: string;
  }): Promise<{ items: ContentResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listContent({
        limit: params?.limit,
        offset: params?.offset,
        source_id: params?.sourceId,
        status: params?.status,
      }),
    );
    return { items: result.items || [], total: result.total || 0 };
  }

  async createContent(data: {
    externalId: string;
    sourceId: string;
    text?: string;
    rawData?: Record<string, any>;
    receivedViaId?: string;
    sourceDate?: string;
  }): Promise<ContentResponse> {
    return await firstValueFrom(
      this.databaseService.createContent({
        external_id: data.externalId,
        source_id: data.sourceId,
        text: data.text,
        raw_data_json: data.rawData ? JSON.stringify(data.rawData) : undefined,
        received_via_id: data.receivedViaId,
        source_date: data.sourceDate,
      }),
    );
  }

  async updateContent(
    id: string,
    data: {
      text?: string;
      isVectorized?: boolean;
      qdrantId?: string;
      embeddingModel?: string;
      aiAnalysis?: Record<string, any>;
      status?: string;
    },
  ): Promise<ContentResponse> {
    const ai_analysis_json = data.aiAnalysis
      ? JSON.stringify(data.aiAnalysis)
      : undefined;

    // Debug logging
    if (data.aiAnalysis) {
      this.logger.debug(
        `Sending aiAnalysis for content ${id}, JSON length: ${ai_analysis_json?.length}`,
      );
    }

    return await firstValueFrom(
      this.databaseService.updateContent({
        id,
        text: data.text,
        is_vectorized: data.isVectorized,
        qdrant_id: data.qdrantId,
        embedding_model: data.embeddingModel,
        ai_analysis_json,
        status: data.status,
      }),
    );
  }

  async getLastContentForSource(
    sourceId: string,
  ): Promise<ContentResponse | null> {
    try {
      return await firstValueFrom(
        this.databaseService.getLastContentForSource({ source_id: sourceId }),
      );
    } catch (e: any) {
      // NOT_FOUND (code 5) означает что для этого источника еще нет контента
      if (e?.code === 5 || e?.details?.includes('No content found')) {
        return null;
      }
      // Другие ошибки пробрасываем
      throw e;
    }
  }

  async upsertContentVector(
    contentId: string,
    data: {
      vector: number[];
      summary?: string;
      category?: string;
      language?: string;
    },
  ): Promise<{ qdrant_id: string; success: boolean }> {
    return await firstValueFrom(
      this.databaseService.upsertContentVector({
        content_id: contentId,
        vector: data.vector,
        summary: data.summary,
        category: data.category,
        language: data.language,
      }),
    );
  }

  // ===================================
  // WORKSPACE METHODS
  // ===================================

  async getWorkspace(id: string): Promise<WorkspaceResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getWorkspace({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listWorkspaces(userId: string): Promise<WorkspaceResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.listWorkspaces({ user_id: userId }),
    );
    return result.workspaces || [];
  }

  async createWorkspace(data: {
    name: string;
    ownerId: string;
    settings?: Record<string, any>;
  }): Promise<WorkspaceResponse> {
    return await firstValueFrom(
      this.databaseService.createWorkspace({
        name: data.name,
        owner_id: data.ownerId,
        settings_json: data.settings
          ? JSON.stringify(data.settings)
          : undefined,
      }),
    );
  }

  async updateWorkspace(
    id: string,
    data: { name?: string; settings?: Record<string, any> },
  ): Promise<WorkspaceResponse> {
    return await firstValueFrom(
      this.databaseService.updateWorkspace({
        id,
        name: data.name,
        settings_json:
          data.settings !== undefined
            ? JSON.stringify(data.settings)
            : undefined,
      }),
    );
  }

  async deleteWorkspace(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.deleteWorkspace({ id }));
  }

  async addWorkspaceUser(
    workspaceId: string,
    userId: string,
    role: string,
  ): Promise<WorkspaceUserResponse> {
    return await firstValueFrom(
      this.databaseService.addWorkspaceUser({
        workspace_id: workspaceId,
        user_id: userId,
        role,
      }),
    );
  }

  async removeWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.databaseService.removeWorkspaceUser({
        workspace_id: workspaceId,
        user_id: userId,
      }),
    );
  }

  async listWorkspaceUsers(
    workspaceId: string,
  ): Promise<WorkspaceUserResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.listWorkspaceUsers({ workspace_id: workspaceId }),
    );
    return result.users || [];
  }

  // ===================================
  // SOURCE METHODS
  // ===================================

  async getSource(id: string): Promise<SourceResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getSource({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async getSourceByExternalId(
    type: string,
    externalId: string,
  ): Promise<SourceResponse | null> {
    try {
      return await firstValueFrom(
        this.databaseService.getSourceByExternalId({
          type,
          external_id: externalId,
        }),
      );
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listSources(params?: {
    limit?: number;
    offset?: number;
    type?: string;
    activeOnly?: boolean;
  }): Promise<{ items: SourceResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listSources({
        limit: params?.limit,
        offset: params?.offset,
        type: params?.type,
        active_only: params?.activeOnly,
      }),
    );
    return { items: result.items || [], total: result.total || 0 };
  }

  async createSource(data: {
    type: string;
    externalId: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
    url?: string;
    language?: string;
    metadata?: Record<string, any>;
  }): Promise<SourceResponse> {
    return await firstValueFrom(
      this.databaseService.createSource({
        type: data.type,
        external_id: data.externalId,
        name: data.name,
        description: data.description,
        avatar_url: data.avatarUrl,
        url: data.url,
        language: data.language,
        metadata_json: data.metadata
          ? JSON.stringify(data.metadata)
          : undefined,
      }),
    );
  }

  async updateSource(
    id: string,
    data: {
      name?: string;
      description?: string;
      avatarUrl?: string;
      url?: string;
      isActive?: boolean;
      language?: string;
      metadata?: Record<string, any>;
      lastSyncAt?: string;
    },
  ): Promise<SourceResponse> {
    return await firstValueFrom(
      this.databaseService.updateSource({
        id,
        name: data.name,
        description: data.description,
        avatar_url: data.avatarUrl,
        url: data.url,
        language: data.language,
        metadata_json:
          data.metadata !== undefined
            ? JSON.stringify(data.metadata)
            : undefined,
        last_sync_at: data.lastSyncAt,
      }),
    );
  }

  async setSourceActive(
    id: string,
    isActive: boolean,
  ): Promise<SourceResponse> {
    return await firstValueFrom(
      this.databaseService.setSourceActive({
        id,
        is_active: isActive,
      }),
    );
  }

  async deleteSource(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.deleteSource({ id }));
  }

  // ===================================
  // WORKSPACE DONOR METHODS
  // ===================================

  async addWorkspaceDonor(
    workspaceId: string,
    sourceId: string,
    settings?: Record<string, any>,
  ): Promise<WorkspaceDonorResponse> {
    return await firstValueFrom(
      this.databaseService.addWorkspaceDonor({
        workspace_id: workspaceId,
        source_id: sourceId,
        settings_json: settings ? JSON.stringify(settings) : undefined,
      }),
    );
  }

  async removeWorkspaceDonor(
    workspaceId: string,
    sourceId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.databaseService.removeWorkspaceDonor({
        workspace_id: workspaceId,
        source_id: sourceId,
      }),
    );
  }

  async listWorkspaceDonors(
    workspaceId: string,
    activeOnly?: boolean,
  ): Promise<WorkspaceDonorResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.listWorkspaceDonors({
        workspace_id: workspaceId,
        active_only: activeOnly,
      }),
    );
    return result.donors || [];
  }

  async updateWorkspaceDonor(
    workspaceId: string,
    sourceId: string,
    data: { isActive?: boolean; settings?: Record<string, any> },
  ): Promise<WorkspaceDonorResponse> {
    return await firstValueFrom(
      this.databaseService.updateWorkspaceDonor({
        workspace_id: workspaceId,
        source_id: sourceId,
        is_active: data.isActive,
        settings_json:
          data.settings !== undefined
            ? JSON.stringify(data.settings)
            : undefined,
      }),
    );
  }

  // ===================================
  // TARGET METHODS
  // ===================================

  async getTarget(id: string): Promise<TargetResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getTarget({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listTargets(
    workspaceId: string,
    params?: { activeOnly?: boolean; type?: string },
  ): Promise<{ targets: TargetResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listTargets({
        workspace_id: workspaceId,
        active_only: params?.activeOnly,
        type: params?.type,
      }),
    );
    return { targets: result.targets || [], total: result.total || 0 };
  }

  async createTarget(data: {
    workspaceId: string;
    type: string;
    externalId: string;
    name?: string;
    description?: string;
    language?: string;
    timezone?: string;
    maxPostsPerDay?: number;
    minPostInterval?: number;
    settings?: Record<string, any>;
    workSchedule?: Record<string, any>;
    accountId?: string;
  }): Promise<TargetResponse> {
    return await firstValueFrom(
      this.databaseService.createTarget({
        workspace_id: data.workspaceId,
        type: data.type,
        external_id: data.externalId,
        name: data.name,
        description: data.description,
        language: data.language,
        timezone: data.timezone,
        max_posts_per_day: data.maxPostsPerDay,
        min_post_interval: data.minPostInterval,
        settings_json: data.settings
          ? JSON.stringify(data.settings)
          : undefined,
        work_schedule_json: data.workSchedule
          ? JSON.stringify(data.workSchedule)
          : undefined,
        account_id: data.accountId,
      }),
    );
  }

  async updateTarget(
    id: string,
    data: {
      name?: string;
      description?: string;
      language?: string;
      timezone?: string;
      maxPostsPerDay?: number;
      minPostInterval?: number;
      settings?: Record<string, any>;
      workSchedule?: Record<string, any>;
      accountId?: string;
      isActive?: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<TargetResponse> {
    return await firstValueFrom(
      this.databaseService.updateTarget({
        id,
        name: data.name,
        description: data.description,
        language: data.language,
        timezone: data.timezone,
        max_posts_per_day: data.maxPostsPerDay,
        min_post_interval: data.minPostInterval,
        settings_json:
          data.settings !== undefined
            ? JSON.stringify(data.settings)
            : undefined,
        work_schedule_json:
          data.workSchedule !== undefined
            ? JSON.stringify(data.workSchedule)
            : undefined,
        account_id: data.accountId,
        is_active: data.isActive,
        metadata_json:
          data.metadata !== undefined
            ? JSON.stringify(data.metadata)
            : undefined,
      }),
    );
  }

  async deleteTarget(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.deleteTarget({ id }));
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

  async createAiPrompt(data: {
    key: string;
    name: string;
    description?: string;
    template: string;
    provider: string;
    category: string;
    modelSettings?: string;
    variantGroup?: string;
    variantName?: string;
    createdById?: string;
  }): Promise<AiPromptResponse> {
    return await firstValueFrom(
      this.databaseService.createAiPrompt({
        key: data.key,
        name: data.name,
        description: data.description,
        template: data.template,
        provider: data.provider,
        category: data.category,
        model_settings_json: data.modelSettings,
        variant_group: data.variantGroup,
        variant_name: data.variantName,
        created_by_id: data.createdById,
      }),
    );
  }

  async updateAiPrompt(
    id: string,
    data: { template: string; changeNote?: string; changedBy?: string },
  ): Promise<AiPromptResponse> {
    return await firstValueFrom(
      this.databaseService.updateAiPrompt({
        id,
        template: data.template,
        change_note: data.changeNote,
        changed_by: data.changedBy,
      }),
    );
  }

  async toggleAiPrompt(
    id: string,
    isActive: boolean,
  ): Promise<AiPromptResponse> {
    return await firstValueFrom(
      this.databaseService.toggleAiPrompt({
        id,
        is_active: isActive,
      }),
    );
  }

  async deleteAiPrompt(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.deleteAiPrompt({ id }));
  }

  async getAiPromptVersions(id: string): Promise<AiPromptVersionsResponse> {
    return await firstValueFrom(
      this.databaseService.getAiPromptVersions({ id }),
    );
  }

  async incrementAiPromptUsage(id: string): Promise<void> {
    await firstValueFrom(this.databaseService.incrementAiPromptUsage({ id }));
  }

  // ===================================
  // RAW CONTENT METHODS
  // ===================================

  async createRawContent(data: {
    sourceId: string;
    externalId: string;
    text: string;
    media?: any[];
    urls?: string[];
    sourceMeta?: Record<string, any>;
    receivedAt?: string;
  }): Promise<RawContentResponse> {
    // Логирование перед отправкой в gRPC
    this.logger.debug(
      `[TEXT_TRACE] DatabaseGrpcClient.createRawContent:\n` +
      `  - Input text: "${data.text}"\n` +
      `  - Input text length: ${data.text?.length || 0}\n` +
      `  - External ID: ${data.externalId}`,
    );

    const result = await firstValueFrom(
      this.databaseService.createRawContent({
        source_id: data.sourceId,
        external_id: data.externalId,
        text: data.text,
        media_json: data.media ? JSON.stringify(data.media) : undefined,
        urls_json: data.urls ? JSON.stringify(data.urls) : undefined,
        source_meta_json: data.sourceMeta
          ? JSON.stringify(data.sourceMeta)
          : undefined,
        received_at: data.receivedAt,
      }),
    );

    // Логирование после получения ответа
    this.logger.debug(
      `[TEXT_TRACE] DatabaseGrpcClient received response:\n` +
      `  - Response text: "${result.text}"\n` +
      `  - Response text length: ${result.text?.length || 0}\n` +
      `  - RawContent ID: ${result.id}`,
    );

    return result;
  }

  async getRawContent(id: string): Promise<RawContentResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getRawContent({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async updateRawContentStatus(
    id: string,
    status: string,
    processedAt?: string,
  ): Promise<RawContentResponse> {
    return await firstValueFrom(
      this.databaseService.updateRawContentStatus({
        id,
        status,
        processed_at: processedAt,
      }),
    );
  }

  async listPendingRawContent(
    limit = 10,
  ): Promise<{ items: RawContentResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listPendingRawContent({ limit }),
    );
    return { items: result.items || [], total: result.total || 0 };
  }

  async listRawContent(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    sourceId?: string;
  }): Promise<{ items: RawContentResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listRawContent({
        limit: params?.limit,
        offset: params?.offset,
        source_id: params?.sourceId,
        status: params?.status,
      }),
    );
    return { items: result.items || [], total: result.total || 0 };
  }

  /**
   * Проверить существование RawContent по externalIds (batch query)
   *
   * @param sourceId - ID источника
   * @param externalIds - массив externalId для проверки
   * @returns Set с существующими externalIds
   */
  async checkRawContentExists(
    sourceId: string,
    externalIds: string[],
  ): Promise<Set<string>> {
    const result = await firstValueFrom(
      this.databaseService.checkRawContentExists({
        source_id: sourceId,
        external_ids: externalIds,
      }),
    );
    return new Set(result.existing_external_ids || []);
  }

  // ===================================
  // CONTENT UNIT METHODS
  // ===================================

  async createContentUnit(
    data: CreateContentUnitRequest,
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(this.databaseService.createContentUnit(data));
  }

  async createContentUnits(
    units: CreateContentUnitRequest[],
  ): Promise<ContentUnitResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.createContentUnits({ units }),
    );
    return result.units || [];
  }

  async getContentUnit(id: string): Promise<ContentUnitResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getContentUnit({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listContentUnits(params?: {
    rawContentId?: string;
    minQualityScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ContentUnitResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listContentUnits({
        raw_content_id: params?.rawContentId,
        min_quality_score: params?.minQualityScore,
        limit: params?.limit,
        offset: params?.offset,
      }),
    );
    return { items: result.items || [], total: result.total || 0 };
  }

  async updateContentUnitVector(
    id: string,
    qdrantId: string,
    embeddingModel: string,
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.updateContentUnitVector({
        id,
        qdrant_id: qdrantId,
        embedding_model: embeddingModel,
      }),
    );
  }

  async updateContentUnitTopic(
    id: string,
    topicId: string,
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.updateContentUnitTopic({
        id,
        topic_id: topicId,
      }),
    );
  }

  async upsertContentUnitVector(
    unitId: string,
    data: {
      vector: number[];
      summary?: string;
      contentType?: string;
      language?: string;
    },
  ): Promise<{ qdrant_id: string; success: boolean }> {
    return await firstValueFrom(
      this.databaseService.upsertContentUnitVector({
        unit_id: unitId,
        vector: data.vector,
        summary: data.summary,
        content_type: data.contentType,
        language: data.language,
      }),
    );
  }

  async searchSimilarUnits(
    qdrantId: string,
    options?: { limit?: number; minScore?: number },
  ): Promise<SimilarUnitResult[]> {
    const result = await firstValueFrom(
      this.databaseService.searchSimilarUnits({
        qdrant_id: qdrantId,
        limit: options?.limit,
        min_score: options?.minScore,
      }),
    );
    return result.units || [];
  }

  /**
   * Обновить ContentUnit с результатами анализа из STAGE 2.
   */
  async updateContentUnitAnalysis(
    id: string,
    data: {
      summary?: string;
      entities?: any;
      keywords?: string[];
      sentiment?: any;
      needsFactCheck?: boolean;
      factCheckHint?: any;
    },
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.updateContentUnitAnalysis({
        id,
        summary: data.summary,
        entities_json: data.entities ? JSON.stringify(data.entities) : undefined,
        keywords_json: data.keywords ? JSON.stringify(data.keywords) : undefined,
        sentiment: data.sentiment ? JSON.stringify(data.sentiment) : undefined,
        needs_fact_check: data.needsFactCheck,
        fact_check_hint_json: data.factCheckHint
          ? JSON.stringify(data.factCheckHint)
          : undefined,
      }),
    );
  }

  /**
   * Обновить ContentUnit с результатами факт-чекинга из STAGE 3.
   */
  async updateContentUnitFactCheck(
    id: string,
    factCheckResult: any,
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.updateContentUnitFactCheck({
        id,
        fact_check_result_json: JSON.stringify(factCheckResult),
      }),
    );
  }

  /**
   * Batch обновление факт-чекинга для нескольких units.
   */
  async updateContentUnitsFactCheck(updates: Array<{ id: string; factCheckResult: any }>): Promise<ContentUnitResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.updateContentUnitsFactCheck({
        updates: updates.map((u) => ({
          id: u.id,
          fact_check_result_json: JSON.stringify(u.factCheckResult),
        })),
      }),
    );
    return result.units || [];
  }

  // ===========================================
  // STATE MACHINE METHODS (для идемпотентности)
  // ===========================================

  /**
   * Получить все ContentUnits для данного RawContent.
   * Используется для идемпотентных переходов между этапами.
   */
  async getContentUnitsByRawContentId(rawContentId: string): Promise<ContentUnitResponse[]> {
    const result = await firstValueFrom(
      this.databaseService.getContentUnitsByRawContentId({
        raw_content_id: rawContentId,
      }),
    );
    return result.units || [];
  }

  /**
   * Получить один ContentUnit по ID.
   */
  async getContentUnit(id: string): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.getContentUnit({ id }),
    );
  }

  /**
   * Обновить статус ContentUnit.
   * Используется для отслеживания прогресса обработки.
   */
  async updateContentUnitStatus(
    id: string,
    status: string,
    errorMessage?: string,
  ): Promise<ContentUnitResponse> {
    return await firstValueFrom(
      this.databaseService.updateContentUnitStatus({
        id,
        status,
        processed_at: new Date().toISOString(),
        error_message: errorMessage,
      }),
    );
  }

  /**
   * Поиск похожих Topics (двухуровневый поиск — LEVEL 1).
   */
  async searchSimilarTopics(
    vector: number[],
    options?: { limit?: number; minScore?: number },
  ): Promise<Array<{ topicId: string; qdrantId: string; score: number }>> {
    const result = await firstValueFrom(
      this.databaseService.searchSimilarTopics({
        vector,
        limit: options?.limit,
        min_score: options?.minScore,
      }),
    );
    return (
      result.topics?.map((t) => ({
        topicId: t.topic_id,
        qdrantId: t.qdrant_id,
        score: t.score,
      })) || []
    );
  }

  /**
   * Получить вектор из Qdrant по qdrant_id.
   * Используется для LEVEL 1 поиска Topics.
   */
  async getVectorByQdrantId(
    collectionName: string,
    qdrantId: string,
  ): Promise<number[]> {
    const result = await firstValueFrom(
      this.databaseService.getVectorByQdrantId({
        collection_name: collectionName,
        qdrant_id: qdrantId,
      }),
    );
    return result.vector || [];
  }

  // ===================================
  // TOPIC METHODS
  // ===================================

  async getTopic(id: string): Promise<TopicResponse | null> {
    try {
      return await firstValueFrom(this.databaseService.getTopic({ id }));
    } catch (error: any) {
      if (error.code === 5) return null;
      throw error;
    }
  }

  async listTopics(params?: {
    limit?: number;
    offset?: number;
    type?: string;
    categoryId?: string;
    onlyActive?: boolean;
  }): Promise<{ topics: TopicResponse[]; total: number }> {
    const result = await firstValueFrom(
      this.databaseService.listTopics({
        limit: params?.limit,
        offset: params?.offset,
        type: params?.type,
        category_id: params?.categoryId,
        only_active: params?.onlyActive,
      }),
    );
    return { topics: result.topics || [], total: result.total || 0 };
  }

  async createTopic(data: {
    type: string;
    title: string;
    summary?: string;
    language?: string;
    categoryId?: string;
    embeddingModel?: string;
    qdrantId?: string;
  }): Promise<TopicResponse> {
    return await firstValueFrom(
      this.databaseService.createTopic({
        type: data.type,
        title: data.title,
        summary: data.summary,
        language: data.language,
        category_id: data.categoryId,
        embedding_model: data.embeddingModel,
        qdrant_id: data.qdrantId,
      }),
    );
  }

  async updateTopic(
    id: string,
    data: {
      title?: string;
      summary?: string;
      version?: number;
      relevanceScore?: number;
      isExpired?: boolean;
      embeddingModel?: string;
      qdrantId?: string;
      factCheckStatus?: string;
      factCheckResult?: Record<string, any>;
      factCheckedAt?: string;
    },
  ): Promise<TopicResponse> {
    return await firstValueFrom(
      this.databaseService.updateTopic({
        id,
        title: data.title,
        summary: data.summary,
        version: data.version,
        relevance_score: data.relevanceScore,
        is_expired: data.isExpired,
        embedding_model: data.embeddingModel,
        qdrant_id: data.qdrantId,
        fact_check_status: data.factCheckStatus,
        fact_check_result_json: data.factCheckResult
          ? JSON.stringify(data.factCheckResult)
          : undefined,
        fact_checked_at: data.factCheckedAt,
      }),
    );
  }
}
