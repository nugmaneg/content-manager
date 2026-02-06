import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { PrismaService } from '../storage/prisma.service';
import { QdrantService } from '../storage/qdrant.service';

// --- REQUEST INTERFACES ---

// Content
interface GetContentRequest {
  id: string;
}
interface ListContentRequest {
  limit?: number;
  offset?: number;
  sourceId?: string;
  status?: string;
}
interface CreateContentRequest {
  external_id: string;
  source_id: string;
  text?: string;
  raw_data_json?: string;
  received_via_id?: string;
  source_date?: string;
}
interface UpdateContentRequest {
  id: string;
  text?: string;
  is_vectorized?: boolean;
  qdrant_id?: string;
  embedding_model?: string;
  ai_analysis_json?: string;
  status?: string;
}
interface GetLastContentForSourceRequest {
  source_id: string;
}
interface UpsertContentVectorRequest {
  content_id: string;
  vector: number[];
  summary?: string;
  category?: string;
  language?: string;
}

// RawContent
interface CreateRawContentRequest {
  source_id: string;
  external_id: string;
  text: string;
  media_json?: string;
  urls_json?: string;
  source_meta_json?: string;
  received_at?: string;
}
interface GetRawContentRequest {
  id: string;
}
interface UpdateRawContentStatusRequest {
  id: string;
  status: string;
  processed_at?: string;
}
interface ListPendingRawContentRequest {
  limit?: number;
}
interface ListRawContentRequest {
  limit?: number;
  offset?: number;
  status?: string;
  source_id?: string;
}
interface CheckRawContentExistsRequest {
  source_id: string;
  external_ids: string[];
}
interface CheckRawContentExistsResponse {
  existing_external_ids: string[];
}

// ContentUnit
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
interface CreateContentUnitsRequest {
  units: CreateContentUnitRequest[];
}
interface GetContentUnitRequest {
  id: string;
}
interface ListContentUnitsRequest {
  raw_content_id?: string;
  min_quality_score?: number;
  limit?: number;
  offset?: number;
}
interface UpdateContentUnitVectorRequest {
  id: string;
  qdrant_id: string;
  embedding_model: string;
}
interface UpdateContentUnitAnalysisRequest {
  id: string;
  summary?: string;
  entities?: any; // ContentEntities
  keywords?: string[];
  sentiment?: any; // { label, score }
  needsFactCheck?: boolean;
  factCheckHint?: any; // FactCheckHint
}
interface UpdateContentUnitFactCheckRequest {
  id: string;
  factCheckResult: any; // FactCheckResult
}
interface UpdateContentUnitsFactCheckRequest {
  updates: UpdateContentUnitFactCheckRequest[];
}

// Topic
interface GetTopicRequest {
  id: string;
}
interface ListTopicsRequest {
  limit?: number;
  offset?: number;
  type?: string;
  category_id?: string;
  only_active?: boolean;
}
interface CreateTopicRequest {
  type: string;
  title: string;
  summary?: string;
  language?: string;
  category_id?: string;
  embedding_model?: string;
  qdrant_id?: string;
}
interface UpdateTopicRequest {
  id: string;
  title?: string;
  summary?: string;
  version?: number;
  relevance_score?: number;
  is_expired?: boolean;
  embedding_model?: string;
  qdrant_id?: string;
  qdrant_id_to_null?: string;
}
interface AddContentToTopicRequest {
  topic_id: string;
  content_id: string;
  is_primary?: boolean;
}

// Publication
interface GetPublicationRequest {
  id: string;
}
interface ListPublicationsRequest {
  limit?: number;
  offset?: number;
  status?: string;
  target_id?: string;
  only_due?: boolean;
}
interface CreatePublicationRequest {
  workspace_topic_id: string;
  target_id: string;
  topic_version: number;
  scheduled_at?: string;
  content_override_json?: string;
}
interface UpdatePublicationStatusRequest {
  id: string;
  status: string;
  error?: string;
  external_id?: string;
  published_at?: string;
  retry_count?: number;
  next_retry_at?: string;
}

// AiLog
interface CreateAiLogRequest {
  agent_id?: string;
  resource_type: string;
  resource_id: string;
  prompt?: string;
  response?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  cost?: number;
  success: boolean;
  error?: string;
}

// Search
interface SearchSimilarRequest {
  vector: number[];
  limit?: number;
  min_score?: number;
}

// User (Auth) - fields must match proto definition (snake_case)
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
interface CountUsersRequest { }

// Workspace
interface GetWorkspaceRequest {
  id: string;
}
interface ListWorkspacesRequest {
  user_id: string;
}
interface CreateWorkspaceRequest {
  name: string;
  owner_id: string;
  settings_json?: string;
}
interface UpdateWorkspaceRequest {
  id: string;
  name?: string;
  settings_json?: string;
}
interface DeleteWorkspaceRequest {
  id: string;
}
interface AddWorkspaceUserRequest {
  workspace_id: string;
  user_id: string;
  role: string;
}
interface RemoveWorkspaceUserRequest {
  workspace_id: string;
  user_id: string;
}
interface ListWorkspaceUsersRequest {
  workspace_id: string;
}

// Source
interface GetSourceRequest {
  id: string;
}
interface GetSourceByExternalIdRequest {
  type: string;
  external_id: string;
}
interface ListSourcesRequest {
  limit?: number;
  offset?: number;
  type?: string;
  active_only?: boolean;
}
interface CreateSourceRequest {
  type: string;
  external_id: string;
  name?: string;
  description?: string;
  avatar_url?: string;
  url?: string;
  language?: string;
  metadata_json?: string;
}
interface UpdateSourceRequest {
  id: string;
  name?: string;
  description?: string;
  avatar_url?: string;
  url?: string;
  is_active?: boolean;
  language?: string;
  metadata_json?: string;
  last_sync_at?: string;
}
interface DeleteSourceRequest {
  id: string;
}

@Controller()
export class DatabaseGrpcController {
  private readonly logger = new Logger(DatabaseGrpcController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
  ) { }

  // ===================================
  // CONTENT
  // ===================================

  @GrpcMethod('DatabaseService', 'GetContent')
  async getContent(data: GetContentRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Content ID required',
      });

    const content = await this.prisma.content.findUnique({
      where: { id: data.id },
    });
    if (!content)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Content not found: ${data.id}`,
      });

    const rawContent = await this.prisma.rawContent.findUnique({
      where: {
        sourceId_externalId: {
          sourceId: content.sourceId,
          externalId: content.externalId,
        },
      },
      include: { units: true },
    });

    return this.mapContent({ ...content, rawContent });
  }

  @GrpcMethod('DatabaseService', 'ListContent')
  async listContent(data: ListContentRequest) {
    const limit = Math.min(data.limit || 10, 100);
    const offset = data.offset || 0;
    const where: any = {};
    if (data.sourceId) where.sourceId = data.sourceId;
    if (data.status) where.status = data.status;

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.content.count({ where }),
    ]);

    const rawContents =
      items.length > 0
        ? await this.prisma.rawContent.findMany({
          where: {
            OR: items.map((i) => ({
              sourceId: i.sourceId,
              externalId: i.externalId,
            })),
          },
          include: { units: true },
        })
        : [];

    const rawContentMap = new Map();
    rawContents.forEach((rc) => {
      rawContentMap.set(`${rc.sourceId}_${rc.externalId}`, rc);
    });

    return {
      items: items.map((item) => {
        const key = `${item.sourceId}_${item.externalId}`;
        return this.mapContent({ ...item, rawContent: rawContentMap.get(key) });
      }),
      total,
    };
  }

  @GrpcMethod('DatabaseService', 'CreateContent')
  async createContent(data: CreateContentRequest) {
    try {
      const content = await this.prisma.content.create({
        data: {
          externalId: data.external_id,
          sourceId: data.source_id,
          text: data.text,
          rawData: data.raw_data_json
            ? JSON.parse(data.raw_data_json)
            : undefined,
          receivedViaId: data.received_via_id || undefined,
          sourceDate: data.source_date ? new Date(data.source_date) : undefined,
        },
      });
      return this.mapContent(content);
    } catch (e: any) {
      // Handle duplicate entry (Unique constraint violated on sourceId+externalId)
      if (e.code === 'P2002') {
        this.logger.debug(
          `Content already exists: ${data.external_id} for source ${data.source_id}`,
        );
        const existing = await this.prisma.content.findUnique({
          where: {
            sourceId_externalId: {
              sourceId: data.source_id,
              externalId: data.external_id,
            },
          },
        });
        if (existing) return this.mapContent(existing);
      }

      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create content',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateContent')
  async updateContent(data: UpdateContentRequest) {
    try {
      const updateData: any = {};
      if (data.text !== undefined && data.text !== '')
        updateData.text = data.text;
      if (data.is_vectorized !== undefined)
        updateData.isVectorized = data.is_vectorized;
      if (data.qdrant_id !== undefined && data.qdrant_id !== '')
        updateData.qdrantId = data.qdrant_id;
      if (data.embedding_model !== undefined && data.embedding_model !== '')
        updateData.embeddingModel = data.embedding_model;
      if (data.status !== undefined && data.status !== '')
        updateData.status = data.status;

      // Debug: проверим что приходит в ai_analysis_json
      this.logger.debug(
        `ai_analysis_json: type=${typeof data.ai_analysis_json}, length=${data.ai_analysis_json?.length}, value=${data.ai_analysis_json?.substring(0, 100)}`,
      );

      if (data.ai_analysis_json !== undefined && data.ai_analysis_json !== '') {
        try {
          updateData.aiAnalysis = JSON.parse(data.ai_analysis_json);
          this.logger.debug(`Parsed aiAnalysis successfully`);
        } catch (jsonError) {
          this.logger.error(
            `Failed to parse ai_analysis_json for content ${data.id}`,
            jsonError,
          );
          throw new RpcException({
            code: status.INVALID_ARGUMENT,
            message: 'Invalid JSON in ai_analysis_json',
          });
        }
      }

      this.logger.debug(
        `Updating content ${data.id} with fields: ${Object.keys(updateData).join(', ')}`,
      );

      const content = await this.prisma.content.update({
        where: { id: data.id },
        data: updateData,
      });

      this.logger.debug(`Successfully updated content ${data.id}`);
      return this.mapContent(content);
    } catch (e: any) {
      if (e.code === 'P2025') {
        this.logger.warn(`Content not found: ${data.id}`);
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Content not found',
        });
      }

      this.logger.error(`Failed to update content ${data.id}:`, e);
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to update content: ${e.message}`,
      });
    }
  }

  @GrpcMethod('DatabaseService', 'GetLastContentForSource')
  async getLastContentForSource(data: { source_id: string }) {
    if (!data.source_id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Source ID required',
      });

    const content = await this.prisma.content.findFirst({
      where: { sourceId: data.source_id },
      orderBy: { sourceDate: 'desc' },
    });

    if (!content) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'No content found for this source',
      });
    }

    return this.mapContent(content);
  }

  @GrpcMethod('DatabaseService', 'UpsertContentVector')
  async upsertContentVector(data: UpsertContentVectorRequest) {
    if (!data.content_id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Content ID required',
      });
    if (!data.vector || data.vector.length === 0)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Vector required',
      });

    try {
      // Используем content_id как qdrant_id для простоты
      const qdrantId = data.content_id;

      // Сохраняем вектор в Qdrant
      await this.qdrant.upsertVector(
        this.qdrant.getContentCollectionName(),
        qdrantId,
        data.vector,
        {
          contentId: data.content_id,
          summary: data.summary || '',
          category: data.category || '',
          language: data.language || '',
        },
      );

      // Обновляем Content с qdrantId
      await this.prisma.content.update({
        where: { id: data.content_id },
        data: { qdrantId, isVectorized: true },
      });

      this.logger.log(`Saved vector to Qdrant for content ${data.content_id}`);

      return { qdrant_id: qdrantId, success: true };
    } catch (e: any) {
      this.logger.error(
        `Failed to upsert vector for content ${data.content_id}:`,
        e,
      );
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to save vector: ${e.message}`,
      });
    }
  }

  // ===================================
  // TOPIC
  // ===================================

  @GrpcMethod('DatabaseService', 'GetTopic')
  async getTopic(data: GetTopicRequest) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: data.id },
    });
    if (!topic)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Topic not found',
      });
    return this.mapTopic(topic);
  }

  @GrpcMethod('DatabaseService', 'ListTopics')
  async listTopics(data: ListTopicsRequest) {
    const where: any = {};
    if (data.type) where.type = data.type as any;
    if (data.category_id) where.categoryId = data.category_id;
    if (data.only_active) where.isExpired = false;

    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        take: data.limit || 10,
        skip: data.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return { items: items.map(this.mapTopic), total };
  }

  @GrpcMethod('DatabaseService', 'CreateTopic')
  async createTopic(data: CreateTopicRequest) {
    // Validate TopicType enum - fallback to 'other' for invalid values
    const validTopicTypes = ['news', 'opinion', 'rumor', 'guide', 'review', 'digest', 'announcement', 'quote', 'other'];
    const topicType = validTopicTypes.includes(data.type) ? data.type : 'other';

    if (data.type && !validTopicTypes.includes(data.type)) {
      this.logger.warn(`Invalid TopicType "${data.type}" received, falling back to "other"`);
    }

    // Handle empty categoryId - convert to undefined to prevent FK constraint violation
    const categoryId = data.category_id && data.category_id.trim() !== ''
      ? data.category_id
      : undefined;

    const topic = await this.prisma.topic.create({
      data: {
        type: topicType as any,
        title: data.title,
        summary: data.summary,
        language: data.language || 'ru',
        categoryId,
        embeddingModel: data.embedding_model,
        qdrantId: data.qdrant_id,
      },
    });
    return this.mapTopic(topic);
  }

  @GrpcMethod('DatabaseService', 'UpdateTopic')
  async updateTopic(data: UpdateTopicRequest) {
    const updateData: any = {};
    if (data.title) updateData.title = data.title;
    if (data.summary) updateData.summary = data.summary;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.relevance_score !== undefined) updateData.relevanceScore = data.relevance_score;
    if (data.is_expired !== undefined) updateData.isExpired = data.is_expired;
    if (data.embedding_model) updateData.embeddingModel = data.embedding_model;
    if (data.qdrant_id) updateData.qdrantId = data.qdrant_id;
    if (data.qdrant_id_to_null) updateData.qdrantId = null;
    // Fact-check fields
    if ((data as any).fact_check_status)
      updateData.factCheckStatus = (data as any).fact_check_status;
    if ((data as any).fact_check_result_json)
      updateData.factCheckResult = JSON.parse((data as any).fact_check_result_json);
    if ((data as any).fact_checked_at)
      updateData.factCheckedAt = new Date((data as any).fact_checked_at);

    const topic = await this.prisma.topic.update({
      where: { id: data.id },
      data: updateData,
    });
    return this.mapTopic(topic);
  }

  @GrpcMethod('DatabaseService', 'AddContentToTopic')
  async addContentToTopic(data: AddContentToTopicRequest) {
    await this.prisma.contentTopic.create({
      data: {
        topicId: data.topic_id,
        contentId: data.content_id,
        isPrimary: data.is_primary || false,
      },
    });
    // Return updated topic
    return this.getTopic({ id: data.topic_id });
  }

  // ===================================
  // PUBLICATION
  // ===================================

  @GrpcMethod('DatabaseService', 'GetPublication')
  async getPublication(data: GetPublicationRequest) {
    const pub = await this.prisma.publication.findUnique({
      where: { id: data.id },
    });
    if (!pub)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Publication not found',
      });
    return this.mapPublication(pub);
  }

  @GrpcMethod('DatabaseService', 'ListPublications')
  async listPublications(data: ListPublicationsRequest) {
    const where: any = {};
    if (data.status) where.status = data.status;
    if (data.target_id) where.targetId = data.target_id;
    if (data.only_due) {
      where.OR = [
        { status: 'PENDING' },
        { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        take: data.limit || 10,
        skip: data.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.publication.count({ where }),
    ]);
    return { items: items.map(this.mapPublication), total };
  }

  @GrpcMethod('DatabaseService', 'CreatePublication')
  async createPublication(data: CreatePublicationRequest) {
    try {
      const pub = await this.prisma.publication.create({
        data: {
          workspaceTopicId: data.workspace_topic_id,
          targetId: data.target_id,
          topicVersion: data.topic_version,
          scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : null,
          contentOverride: data.content_override_json
            ? JSON.parse(data.content_override_json)
            : undefined,
          status: data.scheduled_at ? 'SCHEDULED' : 'PENDING',
        },
      });
      return this.mapPublication(pub);
    } catch (e) {
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create publication',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdatePublicationStatus')
  async updatePublicationStatus(data: UpdatePublicationStatusRequest) {
    try {
      const updateData: any = {};
      if (data.status) updateData.status = data.status;
      if (data.error !== undefined) updateData.error = data.error;
      if (data.external_id !== undefined)
        updateData.externalId = data.external_id;
      if (data.published_at)
        updateData.publishedAt = new Date(data.published_at);
      if (data.retry_count !== undefined)
        updateData.retryCount = data.retry_count;
      if (data.next_retry_at)
        updateData.nextRetryAt = new Date(data.next_retry_at);

      const pub = await this.prisma.publication.update({
        where: { id: data.id },
        data: updateData,
      });
      return this.mapPublication(pub);
    } catch (e) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Publication not found or update failed',
      });
    }
  }

  // ===================================
  // AI LOG
  // ===================================

  @GrpcMethod('DatabaseService', 'CreateAiLog')
  async createAiLog(data: CreateAiLogRequest) {
    const log = await this.prisma.aiLog.create({
      data: {
        agentId: data.agent_id,
        resourceType: data.resource_type,
        resourceId: data.resource_id,
        prompt: data.prompt,
        response: data.response,
        inputTokens: data.input_tokens,
        outputTokens: data.output_tokens,
        latencyMs: data.latency_ms,
        cost: data.cost,
        success: data.success,
        error: data.error,
      },
    });
    return { id: log.id, success: true };
  }

  // ===================================
  // SEARCH
  // ===================================

  @GrpcMethod('DatabaseService', 'SearchSimilarContent')
  async searchSimilarContent(data: SearchSimilarRequest) {
    if (!data.vector || data.vector.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Vector required',
      });
    }

    const results = await this.qdrant.searchSimilar(
      this.qdrant.getContentCollectionName(),
      data.vector,
      data.limit || 10,
      data.min_score,
    );

    return {
      items: results.map((result) => ({
        id: result.payload?.contentId as string,
        text: result.payload?.text as string,
        score: result.score,
      })),
    };
  }

  @GrpcMethod('DatabaseService', 'SearchSimilarTopics')
  async searchSimilarTopics(data: SearchSimilarRequest) {
    if (!data.vector || data.vector.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Vector required',
      });
    }

    const results = await this.qdrant.searchSimilar(
      this.qdrant.getTopicCollectionName(),
      data.vector,
      data.limit || 10,
      data.min_score,
    );

    return {
      items: results.map((result) => ({
        id: result.payload?.topicId as string,
        text: result.payload?.title as string,
        score: result.score,
      })),
    };
  }

  @GrpcMethod('DatabaseService', 'GetVectorByQdrantId')
  async getVectorByQdrantId(data: {
    collection_name: string;
    qdrant_id: string;
  }) {
    if (!data.collection_name || !data.qdrant_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Collection name and Qdrant ID required',
      });
    }

    try {
      const vector = await this.qdrant.getVectorByQdrantId(
        data.collection_name,
        data.qdrant_id,
      );

      return { vector };
    } catch (error) {
      this.logger.error(
        `Failed to get vector for ${data.qdrant_id} from ${data.collection_name}:`,
        error,
      );
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Vector not found: ${error instanceof Error ? error.message : error}`,
      });
    }
  }

  // ===================================
  // USER (Auth)
  // ===================================

  @GrpcMethod('DatabaseService', 'GetUserById')
  async getUserById(data: GetUserByIdRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'User ID required',
      });

    const user = await this.prisma.user.findUnique({ where: { id: data.id } });
    if (!user)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found',
      });

    return this.mapUser(user);
  }

  @GrpcMethod('DatabaseService', 'GetUserByEmail')
  async getUserByEmail(data: GetUserByEmailRequest) {
    if (!data.email)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Email required',
      });

    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found',
      });

    return this.mapUser(user);
  }

  @GrpcMethod('DatabaseService', 'CreateUser')
  async createUser(data: CreateUserRequest) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.password_hash,
          role: (data.role as any) || 'USER',
        },
      });
      return this.mapUser(user);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'User with this email already exists',
        });
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create user',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateUserRefreshToken')
  async updateUserRefreshToken(data: UpdateUserRefreshTokenRequest) {
    try {
      const user = await this.prisma.user.update({
        where: { id: data.id },
        data: { refreshTokenHash: data.refresh_token_hash || null },
      });
      return this.mapUser(user);
    } catch (e) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'CountUsers')
  async countUsers(_data: CountUsersRequest) {
    const count = await this.prisma.user.count();
    return { count };
  }

  // ===================================
  // WORKSPACE
  // ===================================

  @GrpcMethod('DatabaseService', 'GetWorkspace')
  async getWorkspace(data: GetWorkspaceRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Workspace ID required',
      });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.id },
    });
    if (!workspace)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Workspace not found',
      });

    return this.mapWorkspace(workspace);
  }

  @GrpcMethod('DatabaseService', 'ListWorkspaces')
  async listWorkspaces(data: ListWorkspacesRequest) {
    if (!data.user_id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'User ID required',
      });

    // Find workspaces where user is owner OR member
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: data.user_id },
          { users: { some: { userId: data.user_id } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return { workspaces: workspaces.map(this.mapWorkspace) };
  }

  @GrpcMethod('DatabaseService', 'CreateWorkspace')
  async createWorkspace(data: CreateWorkspaceRequest) {
    try {
      const workspace = await this.prisma.workspace.create({
        data: {
          name: data.name,
          ownerId: data.owner_id,
          settings: data.settings_json ? JSON.parse(data.settings_json) : null,
        },
      });
      return this.mapWorkspace(workspace);
    } catch (e: any) {
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create workspace',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateWorkspace')
  async updateWorkspace(data: UpdateWorkspaceRequest) {
    try {
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.settings_json !== undefined) {
        updateData.settings = data.settings_json
          ? JSON.parse(data.settings_json)
          : null;
      }

      const workspace = await this.prisma.workspace.update({
        where: { id: data.id },
        data: updateData,
      });
      return this.mapWorkspace(workspace);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update workspace',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'DeleteWorkspace')
  async deleteWorkspace(data: DeleteWorkspaceRequest) {
    try {
      await this.prisma.workspace.delete({ where: { id: data.id } });
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to delete workspace',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'AddWorkspaceUser')
  async addWorkspaceUser(data: AddWorkspaceUserRequest) {
    try {
      const workspaceUser = await this.prisma.workspaceUser.create({
        data: {
          workspaceId: data.workspace_id,
          userId: data.user_id,
          role: (data.role as any) || 'VIEWER',
        },
        include: { user: true },
      });
      return this.mapWorkspaceUser(workspaceUser);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'User already in workspace',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to add user to workspace',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'RemoveWorkspaceUser')
  async removeWorkspaceUser(data: RemoveWorkspaceUserRequest) {
    try {
      await this.prisma.workspaceUser.delete({
        where: {
          workspaceId_userId: {
            workspaceId: data.workspace_id,
            userId: data.user_id,
          },
        },
      });
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'User not in workspace',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to remove user from workspace',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'ListWorkspaceUsers')
  async listWorkspaceUsers(data: ListWorkspaceUsersRequest) {
    const users = await this.prisma.workspaceUser.findMany({
      where: { workspaceId: data.workspace_id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return { users: users.map(this.mapWorkspaceUser) };
  }

  // ===================================
  // SOURCE
  // ===================================

  @GrpcMethod('DatabaseService', 'GetSource')
  async getSource(data: GetSourceRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Source ID required',
      });

    const source = await this.prisma.source.findUnique({
      where: { id: data.id },
    });
    if (!source)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Source not found',
      });

    return this.mapSource(source);
  }

  @GrpcMethod('DatabaseService', 'GetSourceByExternalId')
  async getSourceByExternalId(data: GetSourceByExternalIdRequest) {
    if (!data.type || !data.external_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Type and external_id required',
      });
    }

    const source = await this.prisma.source.findUnique({
      where: {
        type_externalId: { type: data.type, externalId: data.external_id },
      },
    });
    if (!source)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Source not found',
      });

    return this.mapSource(source);
  }

  @GrpcMethod('DatabaseService', 'ListSources')
  async listSources(data: ListSourcesRequest) {
    const where: any = {};
    if (data.type) where.type = data.type;
    if (data.active_only) where.isActive = true;

    const [items, total] = await Promise.all([
      this.prisma.source.findMany({
        where,
        take: data.limit || 50,
        skip: data.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.source.count({ where }),
    ]);

    return { items: items.map(this.mapSource), total };
  }

  @GrpcMethod('DatabaseService', 'CreateSource')
  async createSource(data: CreateSourceRequest) {
    if (!data.type || !data.external_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Type and external_id required',
      });
    }

    try {
      const source = await this.prisma.source.create({
        data: {
          type: data.type,
          externalId: data.external_id,
          name: data.name || null,
          description: data.description || null,
          avatarUrl: data.avatar_url || null,
          url: data.url || null,
          language: data.language || null,
          metadata: data.metadata_json ? JSON.parse(data.metadata_json) : null,
        },
      });
      this.logger.log(
        `Created source ${source.id} (${data.type}:${data.external_id})`,
      );
      return this.mapSource(source);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Source with this type and external_id already exists',
        });
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create source',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateSource')
  async updateSource(data: UpdateSourceRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Source ID required',
      });

    try {
      const updateData: any = {};
      // Only update fields that have non-empty values (protobuf sends "" for undefined strings)
      if (data.name) updateData.name = data.name;
      if (data.description) updateData.description = data.description;
      if (data.avatar_url) updateData.avatarUrl = data.avatar_url;
      if (data.url) updateData.url = data.url;
      // Note: is_active is NOT updated here because protobuf can't distinguish false from unset
      // Use a separate endpoint to toggle active status
      if (data.language) updateData.language = data.language;
      if (data.metadata_json) {
        updateData.metadata = JSON.parse(data.metadata_json);
      }
      if (data.last_sync_at) {
        updateData.lastSyncAt = new Date(data.last_sync_at);
      }

      // If no fields to update, just return current source
      if (Object.keys(updateData).length === 0) {
        const source = await this.prisma.source.findUnique({
          where: { id: data.id },
        });
        if (!source)
          throw new RpcException({
            code: status.NOT_FOUND,
            message: 'Source not found',
          });
        return this.mapSource(source);
      }

      const source = await this.prisma.source.update({
        where: { id: data.id },
        data: updateData,
      });
      return this.mapSource(source);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Source not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update source',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'DeleteSource')
  async deleteSource(data: DeleteSourceRequest) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Source ID required',
      });

    try {
      await this.prisma.source.delete({ where: { id: data.id } });
      this.logger.log(`Deleted source ${data.id}`);
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Source not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to delete source',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'SetSourceActive')
  async setSourceActive(data: { id: string; is_active: boolean }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Source ID required',
      });

    try {
      const source = await this.prisma.source.update({
        where: { id: data.id },
        data: { isActive: data.is_active },
      });
      this.logger.log(`Set source ${data.id} active=${data.is_active}`);
      return this.mapSource(source);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Source not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update source status',
      });
    }
  }

  // ===================================
  // HELPERS
  // ===================================

  private mapContent = (item: any) => {
    return {
      id: item.id,
      external_id: item.externalId,
      text: item.text ?? '',
      source_id: item.sourceId,
      received_via_id: item.receivedViaId ?? '',
      qdrant_id: item.qdrantId ?? '',
      is_vectorized: item.isVectorized,
      embedding_model: item.embeddingModel ?? '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
      raw_data_json: item.rawData ? JSON.stringify(item.rawData) : '',
      ai_analysis_json: item.aiAnalysis ? JSON.stringify(item.aiAnalysis) : '',
      raw_content: item.rawContent
        ? this.mapRawContent(item.rawContent)
        : undefined,
      content_units: item.rawContent?.units
        ? item.rawContent.units.map((u) => this.mapContentUnit(u))
        : [],
    };
  };

  private mapSource = (item: any) => {
    return {
      id: item.id,
      type: item.type,
      external_id: item.externalId,
      name: item.name ?? '',
      description: item.description ?? '',
      avatar_url: item.avatarUrl ?? '',
      url: item.url ?? '',
      is_active: item.isActive,
      language: item.language ?? '',
      metadata_json: item.metadata ? JSON.stringify(item.metadata) : '',
      last_sync_at: item.lastSyncAt ? item.lastSyncAt.toISOString() : '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  };

  private mapTopic = (item: any) => {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      summary: item.summary ?? '',
      language: item.language,
      category_id: item.categoryId ?? '',
      embedding_model: item.embeddingModel ?? '',
      qdrant_id: item.qdrantId ?? '',
      version: item.version,
      relevance_score: item.relevanceScore,
      is_expired: item.isExpired,
      // Fact-check fields
      fact_check_status: item.factCheckStatus ?? 'NOT_REQUIRED',
      fact_check_result_json: item.factCheckResult
        ? JSON.stringify(item.factCheckResult)
        : '',
      fact_checked_at: item.factCheckedAt ? item.factCheckedAt.toISOString() : '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  };

  private mapPublication = (item: any) => {
    return {
      id: item.id,
      workspace_topic_id: item.workspaceTopicId,
      target_id: item.targetId,
      status: item.status,
      topic_version: item.topicVersion,
      scheduled_at: item.scheduledAt ? item.scheduledAt.toISOString() : '',
      published_at: item.publishedAt ? item.publishedAt.toISOString() : '',
      external_id: item.externalId ?? '',
      error: item.error ?? '',
      retry_count: item.retryCount,
      next_retry_at: item.nextRetryAt ? item.nextRetryAt.toISOString() : '',
      created_at: item.createdAt.toISOString(),
    };
  };

  private mapUser = (item: any) => {
    return {
      id: item.id,
      email: item.email,
      name: item.name ?? '',
      password_hash: item.passwordHash,
      is_active: item.isActive,
      role: item.role,
      telegram_id: item.telegramId ?? '',
      telegram_username: item.telegramUsername ?? '',
      avatar_url: item.avatarUrl ?? '',
      refresh_token_hash: item.refreshTokenHash ?? '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  };

  private mapWorkspace = (item: any) => {
    return {
      id: item.id,
      name: item.name,
      owner_id: item.ownerId,
      settings_json: item.settings ? JSON.stringify(item.settings) : '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  };

  private mapWorkspaceUser = (item: any) => {
    return {
      id: item.id,
      workspace_id: item.workspaceId,
      user_id: item.userId,
      role: item.role,
      user_email: item.user?.email ?? '',
      user_name: item.user?.name ?? '',
      created_at: item.createdAt.toISOString(),
    };
  };

  private mapWorkspaceDonor = (item: any) => {
    return {
      id: item.id,
      workspace_id: item.workspaceId,
      source_id: item.sourceId,
      is_active: item.isActive,
      settings_json: item.settings ? JSON.stringify(item.settings) : '',
      created_at: item.createdAt.toISOString(),
      source_type: item.source?.type ?? '',
      source_external_id: item.source?.externalId ?? '',
      source_name: item.source?.name ?? '',
    };
  };

  private mapTarget = (item: any) => {
    return {
      id: item.id,
      workspace_id: item.workspaceId,
      type: item.type,
      external_id: item.externalId,
      name: item.name ?? '',
      description: item.description ?? '',
      language: item.language,
      timezone: item.timezone,
      max_posts_per_day: item.maxPostsPerDay ?? 0,
      min_post_interval: item.minPostInterval ?? 0,
      settings_json: item.settings ? JSON.stringify(item.settings) : '',
      work_schedule_json: item.workSchedule
        ? JSON.stringify(item.workSchedule)
        : '',
      account_id: item.accountId ?? '',
      is_active: item.isActive,
      metadata_json: item.metadata ? JSON.stringify(item.metadata) : '',
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  };

  // ===================================
  // WORKSPACE DONOR
  // ===================================

  @GrpcMethod('DatabaseService', 'AddWorkspaceDonor')
  async addWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
    settings_json?: string;
  }) {
    if (!data.workspace_id || !data.source_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id and source_id required',
      });
    }

    try {
      const donor = await this.prisma.workspaceDonor.create({
        data: {
          workspaceId: data.workspace_id,
          sourceId: data.source_id,
          settings: data.settings_json ? JSON.parse(data.settings_json) : null,
        },
        include: { source: true },
      });
      this.logger.log(
        `Added donor: workspace=${data.workspace_id}, source=${data.source_id}`,
      );
      return this.mapWorkspaceDonor(donor);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Source already added to this workspace',
        });
      }
      if (e.code === 'P2003') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace or Source not found',
        });
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to add workspace donor',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'RemoveWorkspaceDonor')
  async removeWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
  }) {
    if (!data.workspace_id || !data.source_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id and source_id required',
      });
    }

    try {
      await this.prisma.workspaceDonor.delete({
        where: {
          workspaceId_sourceId: {
            workspaceId: data.workspace_id,
            sourceId: data.source_id,
          },
        },
      });
      this.logger.log(
        `Removed donor: workspace=${data.workspace_id}, source=${data.source_id}`,
      );
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace donor not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to remove workspace donor',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'ListWorkspaceDonors')
  async listWorkspaceDonors(data: {
    workspace_id: string;
    active_only?: boolean;
  }) {
    if (!data.workspace_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id required',
      });
    }

    const where: any = { workspaceId: data.workspace_id };
    if (data.active_only) where.isActive = true;

    const donors = await this.prisma.workspaceDonor.findMany({
      where,
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });

    return { donors: donors.map(this.mapWorkspaceDonor) };
  }

  @GrpcMethod('DatabaseService', 'UpdateWorkspaceDonor')
  async updateWorkspaceDonor(data: {
    workspace_id: string;
    source_id: string;
    is_active?: boolean;
    settings_json?: string;
  }) {
    if (!data.workspace_id || !data.source_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id and source_id required',
      });
    }

    try {
      const updateData: any = {};
      if (data.is_active !== undefined) updateData.isActive = data.is_active;
      if (data.settings_json !== undefined) {
        updateData.settings = data.settings_json
          ? JSON.parse(data.settings_json)
          : null;
      }

      const donor = await this.prisma.workspaceDonor.update({
        where: {
          workspaceId_sourceId: {
            workspaceId: data.workspace_id,
            sourceId: data.source_id,
          },
        },
        data: updateData,
        include: { source: true },
      });
      return this.mapWorkspaceDonor(donor);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace donor not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update workspace donor',
      });
    }
  }

  // ===================================
  // TARGET
  // ===================================

  @GrpcMethod('DatabaseService', 'GetTarget')
  async getTarget(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Target ID required',
      });

    const target = await this.prisma.target.findUnique({
      where: { id: data.id },
    });
    if (!target)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Target not found',
      });

    return this.mapTarget(target);
  }

  @GrpcMethod('DatabaseService', 'ListTargets')
  async listTargets(data: {
    workspace_id: string;
    active_only?: boolean;
    type?: string;
  }) {
    if (!data.workspace_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id required',
      });
    }

    const where: any = { workspaceId: data.workspace_id };
    if (data.active_only) where.isActive = true;
    if (data.type) where.type = data.type;

    const [targets, total] = await Promise.all([
      this.prisma.target.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.target.count({ where }),
    ]);

    return { targets: targets.map(this.mapTarget), total };
  }

  @GrpcMethod('DatabaseService', 'CreateTarget')
  async createTarget(data: {
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
  }) {
    if (!data.workspace_id || !data.type || !data.external_id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'workspace_id, type, and external_id required',
      });
    }

    try {
      const target = await this.prisma.target.create({
        data: {
          workspaceId: data.workspace_id,
          type: data.type,
          externalId: data.external_id,
          name: data.name || null,
          description: data.description || null,
          language: data.language || 'ru',
          timezone: data.timezone || 'UTC',
          maxPostsPerDay: data.max_posts_per_day || null,
          minPostInterval: data.min_post_interval || null,
          settings: data.settings_json ? JSON.parse(data.settings_json) : null,
          workSchedule: data.work_schedule_json
            ? JSON.parse(data.work_schedule_json)
            : null,
          accountId: data.account_id || null,
        },
      });
      this.logger.log(
        `Created target ${target.id} (${data.type}:${data.external_id})`,
      );
      return this.mapTarget(target);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Target with this type and external_id already exists',
        });
      }
      if (e.code === 'P2003') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Workspace or Account not found',
        });
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create target',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateTarget')
  async updateTarget(data: {
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
  }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Target ID required',
      });

    try {
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.description) updateData.description = data.description;
      if (data.language) updateData.language = data.language;
      if (data.timezone) updateData.timezone = data.timezone;
      if (data.max_posts_per_day !== undefined)
        updateData.maxPostsPerDay = data.max_posts_per_day || null;
      if (data.min_post_interval !== undefined)
        updateData.minPostInterval = data.min_post_interval || null;
      if (data.settings_json !== undefined) {
        updateData.settings = data.settings_json
          ? JSON.parse(data.settings_json)
          : null;
      }
      if (data.work_schedule_json !== undefined) {
        updateData.workSchedule = data.work_schedule_json
          ? JSON.parse(data.work_schedule_json)
          : null;
      }
      if (data.account_id !== undefined)
        updateData.accountId = data.account_id || null;
      if (data.is_active !== undefined) updateData.isActive = data.is_active;
      if (data.metadata_json !== undefined) {
        updateData.metadata = data.metadata_json
          ? JSON.parse(data.metadata_json)
          : null;
      }

      const target = await this.prisma.target.update({
        where: { id: data.id },
        data: updateData,
      });
      return this.mapTarget(target);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Target not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update target',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'DeleteTarget')
  async deleteTarget(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Target ID required',
      });

    try {
      await this.prisma.target.delete({ where: { id: data.id } });
      this.logger.log(`Deleted target ${data.id}`);
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Target not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to delete target',
      });
    }
  }

  // ===================================
  // AI PROMPTS
  // ===================================

  @GrpcMethod('DatabaseService', 'ListAiPrompts')
  async listAiPrompts(data: {
    provider?: string;
    category?: string;
    active_only?: boolean;
  }) {
    const where: any = {};
    if (data.provider) where.provider = data.provider;
    if (data.category) where.category = data.category;
    if (data.active_only) where.isActive = true;

    const prompts = await this.prisma.aiPrompt.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return { prompts: prompts.map(this.mapAiPrompt) };
  }

  @GrpcMethod('DatabaseService', 'GetAiPrompt')
  async getAiPrompt(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt ID required',
      });

    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id: data.id },
    });
    if (!prompt)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Prompt not found',
      });

    return this.mapAiPrompt(prompt);
  }

  @GrpcMethod('DatabaseService', 'GetAiPromptByKey')
  async getAiPromptByKey(data: { key: string }) {
    if (!data.key)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt key required',
      });

    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { key: data.key },
    });
    if (!prompt)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Prompt not found',
      });

    return this.mapAiPrompt(prompt);
  }

  @GrpcMethod('DatabaseService', 'CreateAiPrompt')
  async createAiPrompt(data: {
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
  }) {
    if (!data.key || !data.name || !data.template) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'key, name, and template required',
      });
    }

    try {
      const prompt = await this.prisma.aiPrompt.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description || null,
          template: data.template,
          provider: data.provider || 'xai',
          category: (data.category as any) || 'OTHER',
          modelSettings: data.model_settings_json
            ? JSON.parse(data.model_settings_json)
            : null,
          variantGroup: data.variant_group || null,
          variantName: data.variant_name || null,
          createdById: data.created_by_id || null,
          versions: {
            create: {
              version: 1,
              template: data.template,
              changeNote: 'Initial version',
              changedBy: data.created_by_id || null,
            },
          },
        },
      });
      this.logger.log(`Created AI prompt ${prompt.id} (${data.key})`);
      return this.mapAiPrompt(prompt);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Prompt with this key already exists',
        });
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create prompt',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'UpdateAiPrompt')
  async updateAiPrompt(data: {
    id: string;
    template: string;
    change_note?: string;
    changed_by?: string;
  }) {
    if (!data.id || !data.template) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'id and template required',
      });
    }

    try {
      const current = await this.prisma.aiPrompt.findUnique({
        where: { id: data.id },
      });
      if (!current)
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Prompt not found',
        });

      const newVersion = current.version + 1;

      const prompt = await this.prisma.aiPrompt.update({
        where: { id: data.id },
        data: {
          template: data.template,
          version: newVersion,
          updatedAt: new Date(),
          versions: {
            create: {
              version: newVersion,
              template: data.template,
              changeNote: data.change_note || `Update to version ${newVersion}`,
              changedBy: data.changed_by || null,
            },
          },
        },
      });

      this.logger.log(
        `Updated AI prompt ${current.key} to version ${newVersion}`,
      );
      return this.mapAiPrompt(prompt);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Prompt not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to update prompt',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'ToggleAiPrompt')
  async toggleAiPrompt(data: { id: string; is_active: boolean }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt ID required',
      });

    try {
      const prompt = await this.prisma.aiPrompt.update({
        where: { id: data.id },
        data: { isActive: data.is_active },
      });
      return this.mapAiPrompt(prompt);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Prompt not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to toggle prompt',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'DeleteAiPrompt')
  async deleteAiPrompt(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt ID required',
      });

    try {
      await this.prisma.aiPrompt.delete({ where: { id: data.id } });
      this.logger.log(`Deleted AI prompt ${data.id}`);
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Prompt not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to delete prompt',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'GetAiPromptVersions')
  async getAiPromptVersions(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt ID required',
      });

    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id: data.id },
      select: { key: true, name: true },
    });
    if (!prompt)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Prompt not found',
      });

    const versions = await this.prisma.aiPromptVersion.findMany({
      where: { promptId: data.id },
      orderBy: { version: 'desc' },
    });

    return {
      prompt_key: prompt.key,
      prompt_name: prompt.name,
      versions: versions.map((v) => ({
        id: v.id,
        prompt_id: v.promptId,
        version: v.version,
        template: v.template,
        change_note: v.changeNote || '',
        changed_by: v.changedBy || '',
        created_at: v.createdAt?.toISOString() || '',
      })),
    };
  }

  @GrpcMethod('DatabaseService', 'IncrementAiPromptUsage')
  async incrementAiPromptUsage(data: { id: string }) {
    if (!data.id)
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Prompt ID required',
      });

    try {
      await this.prisma.aiPrompt.update({
        where: { id: data.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
      return {};
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Prompt not found',
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to increment usage',
      });
    }
  }

  // --- AI Prompt Mapper ---
  private mapAiPrompt(prompt: any) {
    return {
      id: prompt.id,
      key: prompt.key,
      name: prompt.name,
      description: prompt.description || '',
      template: prompt.template,
      provider: prompt.provider,
      category: prompt.category,
      version: prompt.version,
      is_active: prompt.isActive,
      usage_count: prompt.usageCount || 0,
      last_used_at: prompt.lastUsedAt?.toISOString() || '',
      model_settings_json: prompt.modelSettings
        ? JSON.stringify(prompt.modelSettings)
        : '',
      variant_group: prompt.variantGroup || '',
      variant_name: prompt.variantName || '',
      created_by_id: prompt.createdById || '',
      created_at: prompt.createdAt?.toISOString() || '',
      updated_at: prompt.updatedAt?.toISOString() || '',
    };
  }

  // ===================================
  // RAW CONTENT
  // ===================================

  @GrpcMethod('DatabaseService', 'CreateRawContent')
  async createRawContent(data: CreateRawContentRequest) {
    try {
      // Логирование при получении gRPC запроса
      this.logger.debug(
        `[TEXT_TRACE] Database gRPC received CreateRawContent:\n` +
        `  - Input text: "${data.text}"\n` +
        `  - Input text length: ${data.text?.length || 0}\n` +
        `  - External ID: ${data.external_id}`,
      );

      const rawContent = await this.prisma.rawContent.create({
        data: {
          sourceId: data.source_id,
          externalId: data.external_id,
          text: data.text,
          mediaJson: data.media_json ? JSON.parse(data.media_json) : undefined,
          urlsJson: data.urls_json ? JSON.parse(data.urls_json) : undefined,
          sourceMetaJson: data.source_meta_json
            ? JSON.parse(data.source_meta_json)
            : undefined,
          receivedAt: data.received_at ? new Date(data.received_at) : new Date(),
          status: 'PENDING',
        },
      });

      // Логирование после сохранения в БД
      this.logger.debug(
        `[TEXT_TRACE] Database saved RawContent:\n` +
        `  - Saved text: "${rawContent.text}"\n` +
        `  - Saved text length: ${rawContent.text?.length || 0}\n` +
        `  - RawContent ID: ${rawContent.id}`,
      );

      return this.mapRawContent(rawContent);
    } catch (e: any) {
      if (e.code === 'P2002') {
        this.logger.debug(
          `RawContent already exists: ${data.external_id} for source ${data.source_id}`,
        );
        const existing = await this.prisma.rawContent.findUnique({
          where: {
            sourceId_externalId: {
              sourceId: data.source_id,
              externalId: data.external_id,
            },
          },
        });
        if (existing) return this.mapRawContent(existing);
      }
      this.logger.error(e);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create raw content',
      });
    }
  }

  @GrpcMethod('DatabaseService', 'GetRawContent')
  async getRawContent(data: GetRawContentRequest) {
    const rawContent = await this.prisma.rawContent.findUnique({
      where: { id: data.id },
    });
    if (!rawContent)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Raw content not found',
      });
    return this.mapRawContent(rawContent);
  }

  @GrpcMethod('DatabaseService', 'UpdateRawContentStatus')
  async updateRawContentStatus(data: UpdateRawContentStatusRequest) {
    const rawContent = await this.prisma.rawContent.update({
      where: { id: data.id },
      data: {
        status: data.status as any,
        processedAt: data.processed_at ? new Date(data.processed_at) : undefined,
      },
    });
    return this.mapRawContent(rawContent);
  }

  @GrpcMethod('DatabaseService', 'ListPendingRawContent')
  async listPendingRawContent(data: ListPendingRawContentRequest) {
    const limit = Math.min(data.limit || 10, 100);
    const [items, total] = await Promise.all([
      this.prisma.rawContent.findMany({
        where: { status: 'PENDING' },
        take: limit,
        orderBy: { receivedAt: 'asc' },
      }),
      this.prisma.rawContent.count({ where: { status: 'PENDING' } }),
    ]);
    return { items: items.map(this.mapRawContent.bind(this)), total };
  }

  @GrpcMethod('DatabaseService', 'ListRawContent')
  async listRawContent(data: ListRawContentRequest) {
    const limit = Math.min(data.limit || 50, 100);
    const offset = data.offset || 0;
    const where: any = {};
    if (data.status) where.status = data.status;
    if (data.source_id) where.sourceId = data.source_id;

    const [items, total] = await Promise.all([
      this.prisma.rawContent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { receivedAt: 'desc' },
        include: {
          units: {
            orderBy: { unitIndex: 'asc' },
          },
        },
      }),
      this.prisma.rawContent.count({ where }),
    ]);
    return { items: items.map(this.mapRawContent.bind(this)), total };
  }

  @GrpcMethod('DatabaseService', 'CheckRawContentExists')
  async checkRawContentExists(
    data: CheckRawContentExistsRequest,
  ): Promise<CheckRawContentExistsResponse> {
    try {
      if (!data.source_id || !data.external_ids || data.external_ids.length === 0) {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'source_id and external_ids required',
        });
      }

      const existing = await this.prisma.rawContent.findMany({
        where: {
          sourceId: data.source_id,
          externalId: { in: data.external_ids },
        },
        select: { externalId: true },
      });

      return {
        existing_external_ids: existing.map((r) => r.externalId),
      };
    } catch (e: any) {
      this.logger.error(`Error checking RawContent existence: ${e.message}`);
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to check RawContent existence: ${e.message}`,
      });
    }
  }

  private mapRawContent(raw: any) {
    return {
      id: raw.id,
      source_id: raw.sourceId,
      external_id: raw.externalId,
      text: raw.text || '',
      media_json: raw.mediaJson ? JSON.stringify(raw.mediaJson) : '',
      urls_json: raw.urlsJson ? JSON.stringify(raw.urlsJson) : '',
      content_units: raw.units
        ? raw.units.map(this.mapContentUnit.bind(this))
        : [],
      source_meta_json: raw.sourceMetaJson
        ? JSON.stringify(raw.sourceMetaJson)
        : '',
      status: raw.status,
      received_at: raw.receivedAt?.toISOString() || '',
      processed_at: raw.processedAt?.toISOString() || '',
      created_at: raw.createdAt?.toISOString() || '',
    };
  }

  // ===================================
  // CONTENT UNIT
  // ===================================

  @GrpcMethod('DatabaseService', 'CreateContentUnit')
  async createContentUnit(data: CreateContentUnitRequest) {
    const unit = await this.prisma.contentUnit.create({
      data: {
        rawContentId: data.raw_content_id,
        unitIndex: data.unit_index,
        qualityScore: data.quality_score,
        qualityReasoning: data.quality_reasoning,
        originalText: data.original_text,
        contentType: data.content_type,
        categories: data.categories_json ? JSON.parse(data.categories_json) : [],
        summary: data.summary,
        sentiment: data.sentiment,
        keywords: data.keywords_json ? JSON.parse(data.keywords_json) : [],
        language: data.language,
        entitiesJson: data.entities_json
          ? JSON.parse(data.entities_json)
          : undefined,
        linkedMediaIndexes: data.linked_media_indexes_json
          ? JSON.parse(data.linked_media_indexes_json)
          : [],
        needsFactCheck: data.needs_fact_check,
        factCheckHint: data.fact_check_hint_json
          ? JSON.parse(data.fact_check_hint_json)
          : undefined,
      },
    });
    return this.mapContentUnit(unit);
  }

  @GrpcMethod('DatabaseService', 'CreateContentUnits')
  async createContentUnits(data: CreateContentUnitsRequest) {
    const units = await Promise.all(
      data.units.map((u) => this.createContentUnit(u)),
    );
    return { units };
  }

  @GrpcMethod('DatabaseService', 'GetContentUnit')
  async getContentUnit(data: GetContentUnitRequest) {
    const unit = await this.prisma.contentUnit.findUnique({
      where: { id: data.id },
    });
    if (!unit)
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Content unit not found',
      });
    return this.mapContentUnit(unit);
  }

  @GrpcMethod('DatabaseService', 'ListContentUnits')
  async listContentUnits(data: ListContentUnitsRequest) {
    const where: any = {};
    if (data.raw_content_id) where.rawContentId = data.raw_content_id;
    if (data.min_quality_score) where.qualityScore = { gte: data.min_quality_score };

    const limit = Math.min(data.limit || 50, 200);
    const [items, total] = await Promise.all([
      this.prisma.contentUnit.findMany({
        where,
        take: limit,
        skip: data.offset || 0,
        orderBy: { unitIndex: 'asc' },
      }),
      this.prisma.contentUnit.count({ where }),
    ]);
    return { items: items.map(this.mapContentUnit.bind(this)), total };
  }

  @GrpcMethod('DatabaseService', 'UpdateContentUnitVector')
  async updateContentUnitVector(data: UpdateContentUnitVectorRequest) {
    const unit = await this.prisma.contentUnit.update({
      where: { id: data.id },
      data: {
        qdrantId: data.qdrant_id,
        embeddingModel: data.embedding_model,
      },
    });
    return this.mapContentUnit(unit);
  }

  private mapContentUnit(unit: any) {
    return {
      id: unit.id,
      raw_content_id: unit.rawContentId,
      unit_index: unit.unitIndex,
      quality_score: unit.qualityScore,
      quality_reasoning: unit.qualityReasoning,
      original_text: unit.originalText,
      content_type: unit.contentType,
      categories_json: JSON.stringify(unit.categories || []),
      summary: unit.summary,
      sentiment: unit.sentiment,
      keywords_json: JSON.stringify(unit.keywords || []),
      language: unit.language,
      entities_json: unit.entitiesJson ? JSON.stringify(unit.entitiesJson) : '',
      linked_media_indexes_json: JSON.stringify(unit.linkedMediaIndexes || []),
      needs_fact_check: unit.needsFactCheck,
      fact_check_hint_json: unit.factCheckHint
        ? JSON.stringify(unit.factCheckHint)
        : '',
      fact_check_result_json: unit.factCheckResult
        ? JSON.stringify(unit.factCheckResult)
        : '',
      qdrant_id: unit.qdrantId || '',
      embedding_model: unit.embeddingModel || '',
      topic_id: unit.topicId || '',
      created_at: unit.createdAt?.toISOString() || '',
      updated_at: unit.updatedAt?.toISOString() || '',
    };
  }

  @GrpcMethod('DatabaseService', 'UpdateContentUnitTopic')
  async updateContentUnitTopic(data: { id: string; topic_id: string }) {
    const unit = await this.prisma.contentUnit.update({
      where: { id: data.id },
      data: { topicId: data.topic_id },
    });
    return this.mapContentUnit(unit);
  }

  @GrpcMethod('DatabaseService', 'UpsertContentUnitVector')
  async upsertContentUnitVector(data: {
    unit_id: string;
    vector: number[];
    summary?: string;
    content_type?: string;
    language?: string;
  }) {
    const result = await this.qdrant.upsertContentUnitVector(
      data.unit_id,
      {
        vector: data.vector,
        summary: data.summary,
        contentType: data.content_type,
        language: data.language,
      },
    );

    return { qdrant_id: result.qdrantId, success: true };
  }

  @GrpcMethod('DatabaseService', 'SearchSimilarUnits')
  async searchSimilarUnits(data: {
    qdrant_id: string;
    limit?: number;
    min_score?: number;
  }) {
    const results = await this.qdrant.searchSimilarUnits(
      data.qdrant_id,
      { limit: data.limit, minScore: data.min_score },
    );

    // Получить topic_id для каждого unit_id из БД
    const unitsWithTopics = await Promise.all(
      results.map(async (r) => {
        if (!r.unitId) return { unit_id: '', topic_id: '', qdrant_id: r.qdrantId, score: r.score };

        const unit = await this.prisma.contentUnit.findUnique({
          where: { id: r.unitId },
          select: { topicId: true },
        });

        return {
          unit_id: r.unitId,
          topic_id: unit?.topicId || '',
          qdrant_id: r.qdrantId,
          score: r.score,
        };
      }),
    );

    return { units: unitsWithTopics };
  }

  @GrpcMethod('DatabaseService', 'UpdateContentUnitAnalysis')
  async updateContentUnitAnalysis(data: UpdateContentUnitAnalysisRequest) {
    const unit = await this.prisma.contentUnit.update({
      where: { id: data.id },
      data: {
        summary: data.summary,
        entitiesJson: data.entities ? JSON.stringify(data.entities) : undefined,
        keywords: data.keywords ? JSON.stringify(data.keywords) : undefined,
        sentiment: data.sentiment,
        needsFactCheck: data.needsFactCheck,
        factCheckHint: data.factCheckHint
          ? JSON.stringify(data.factCheckHint)
          : undefined,
      },
    });

    return this.mapContentUnit(unit);
  }

  @GrpcMethod('DatabaseService', 'UpdateContentUnitFactCheck')
  async updateContentUnitFactCheck(data: UpdateContentUnitFactCheckRequest) {
    const unit = await this.prisma.contentUnit.update({
      where: { id: data.id },
      data: {
        factCheckResult: JSON.stringify(data.factCheckResult),
      },
    });

    return this.mapContentUnit(unit);
  }

  @GrpcMethod('DatabaseService', 'UpdateContentUnitsFactCheck')
  async updateContentUnitsFactCheck(data: UpdateContentUnitsFactCheckRequest) {
    const promises = data.updates.map((u) =>
      this.updateContentUnitFactCheck(u),
    );

    const results = await Promise.all(promises);

    return { units: results };
  }
}

