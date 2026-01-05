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

interface DatabaseService {
    // User methods
    getUserById(data: GetUserByIdRequest): Observable<UserResponse>;
    getUserByEmail(data: GetUserByEmailRequest): Observable<UserResponse>;
    createUser(data: CreateUserRequest): Observable<UserResponse>;
    updateUserRefreshToken(data: UpdateUserRefreshTokenRequest): Observable<UserResponse>;
    countUsers(data: Record<string, never>): Observable<CountUsersResponse>;

    // Content methods
    getContent(data: { id: string }): Observable<ContentResponse>;
    listContent(data: { limit?: number; offset?: number; source_id?: string; status?: string }): Observable<ListContentResponse>;
    createContent(data: { external_id: string; source_id: string; text?: string; raw_data_json?: string; received_via_id?: string; source_date?: string }): Observable<ContentResponse>;
    updateContent(data: { id: string; text?: string; is_vectorized?: boolean; qdrant_id?: string; embedding_model?: string; ai_analysis_json?: string; status?: string }): Observable<ContentResponse>;
    getLastContentForSource(data: { source_id: string }): Observable<ContentResponse>;
    upsertContentVector(data: { content_id: string; vector: number[]; summary?: string; category?: string; language?: string }): Observable<{ qdrant_id: string; success: boolean }>;


    // Workspace methods
    getWorkspace(data: { id: string }): Observable<WorkspaceResponse>;
    listWorkspaces(data: { user_id: string }): Observable<ListWorkspacesResponse>;
    createWorkspace(data: { name: string; owner_id: string; settings_json?: string }): Observable<WorkspaceResponse>;
    updateWorkspace(data: { id: string; name?: string; settings_json?: string }): Observable<WorkspaceResponse>;
    deleteWorkspace(data: { id: string }): Observable<Record<string, never>>;
    addWorkspaceUser(data: { workspace_id: string; user_id: string; role: string }): Observable<WorkspaceUserResponse>;
    removeWorkspaceUser(data: { workspace_id: string; user_id: string }): Observable<Record<string, never>>;
    listWorkspaceUsers(data: { workspace_id: string }): Observable<ListWorkspaceUsersResponse>;

    // Source methods
    getSource(data: { id: string }): Observable<SourceResponse>;
    getSourceByExternalId(data: { type: string; external_id: string }): Observable<SourceResponse>;
    listSources(data: { limit?: number; offset?: number; type?: string; active_only?: boolean }): Observable<ListSourcesResponse>;
    createSource(data: { type: string; external_id: string; name?: string; description?: string; avatar_url?: string; url?: string; language?: string; metadata_json?: string }): Observable<SourceResponse>;
    updateSource(data: { id: string; name?: string; description?: string; avatar_url?: string; url?: string; language?: string; metadata_json?: string; last_sync_at?: string }): Observable<SourceResponse>;
    setSourceActive(data: { id: string; is_active: boolean }): Observable<SourceResponse>;
    deleteSource(data: { id: string }): Observable<Record<string, never>>;

    // WorkspaceDonor methods
    addWorkspaceDonor(data: { workspace_id: string; source_id: string; settings_json?: string }): Observable<WorkspaceDonorResponse>;
    removeWorkspaceDonor(data: { workspace_id: string; source_id: string }): Observable<Record<string, never>>;
    listWorkspaceDonors(data: { workspace_id: string; active_only?: boolean }): Observable<ListWorkspaceDonorsResponse>;
    updateWorkspaceDonor(data: { workspace_id: string; source_id: string; is_active?: boolean; settings_json?: string }): Observable<WorkspaceDonorResponse>;

    // Target methods
    getTarget(data: { id: string }): Observable<TargetResponse>;
    listTargets(data: { workspace_id: string; active_only?: boolean; type?: string }): Observable<ListTargetsResponse>;
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
}

export { WorkspaceResponse, WorkspaceUserResponse, ListWorkspacesResponse, ListWorkspaceUsersResponse, SourceResponse, ListSourcesResponse, WorkspaceDonorResponse, ListWorkspaceDonorsResponse, TargetResponse, ListTargetsResponse, ContentResponse, ListContentResponse };

@Injectable()
export class DatabaseGrpcClient implements OnModuleInit {
    private readonly logger = new Logger(DatabaseGrpcClient.name);
    private databaseService: DatabaseService;
    private client: ClientGrpc;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const grpcUrl = this.configService.get<string>('DATABASE_GRPC_URL') || 'localhost:50051';

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
                    keepCase: true,   // Keep snake_case from proto
                    defaults: true,    // Include default values (false, 0, "")
                    arrays: true,      // Always return arrays
                    objects: true,     // Always return objects
                },
            },
        }) as ClientGrpc;

        this.databaseService = this.client.getService<DatabaseService>('DatabaseService');
        this.logger.log(`Connected to database gRPC service at ${grpcUrl}`);
    }

    async getUserById(id: string): Promise<UserResponse | null> {
        try {
            return await firstValueFrom(this.databaseService.getUserById({ id }));
        } catch (error: any) {
            if (error.code === 5) { // NOT_FOUND
                return null;
            }
            throw error;
        }
    }

    async getUserByEmail(email: string): Promise<UserResponse | null> {
        try {
            return await firstValueFrom(this.databaseService.getUserByEmail({ email }));
        } catch (error: any) {
            if (error.code === 5) { // NOT_FOUND
                return null;
            }
            throw error;
        }
    }

    async createUser(data: CreateUserRequest): Promise<UserResponse> {
        return await firstValueFrom(this.databaseService.createUser(data));
    }

    async updateUserRefreshToken(id: string, refreshTokenHash: string): Promise<UserResponse> {
        return await firstValueFrom(
            this.databaseService.updateUserRefreshToken({
                id,
                refresh_token_hash: refreshTokenHash,
            })
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

    async listContent(params?: { limit?: number; offset?: number; sourceId?: string; status?: string }): Promise<{ items: ContentResponse[]; total: number }> {
        const result = await firstValueFrom(this.databaseService.listContent({
            limit: params?.limit,
            offset: params?.offset,
            source_id: params?.sourceId,
            status: params?.status,
        }));
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
        return await firstValueFrom(this.databaseService.createContent({
            external_id: data.externalId,
            source_id: data.sourceId,
            text: data.text,
            raw_data_json: data.rawData ? JSON.stringify(data.rawData) : undefined,
            received_via_id: data.receivedViaId,
            source_date: data.sourceDate,
        }));
    }

    async updateContent(id: string, data: {
        text?: string;
        isVectorized?: boolean;
        qdrantId?: string;
        embeddingModel?: string;
        aiAnalysis?: Record<string, any>;
        status?: string;
    }): Promise<ContentResponse> {
        const ai_analysis_json = data.aiAnalysis ? JSON.stringify(data.aiAnalysis) : undefined;

        // Debug logging
        if (data.aiAnalysis) {
            this.logger.debug(`Sending aiAnalysis for content ${id}, JSON length: ${ai_analysis_json?.length}`);
        }

        return await firstValueFrom(this.databaseService.updateContent({
            id,
            text: data.text,
            is_vectorized: data.isVectorized,
            qdrant_id: data.qdrantId,
            embedding_model: data.embeddingModel,
            ai_analysis_json,
            status: data.status,
        }));
    }

    async getLastContentForSource(sourceId: string): Promise<ContentResponse | null> {
        try {
            return await firstValueFrom(
                this.databaseService.getLastContentForSource({ source_id: sourceId })
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

    async upsertContentVector(contentId: string, data: {
        vector: number[];
        summary?: string;
        category?: string;
        language?: string;
    }): Promise<{ qdrant_id: string; success: boolean }> {
        return await firstValueFrom(
            this.databaseService.upsertContentVector({
                content_id: contentId,
                vector: data.vector,
                summary: data.summary,
                category: data.category,
                language: data.language,
            })
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
        const result = await firstValueFrom(this.databaseService.listWorkspaces({ user_id: userId }));
        return result.workspaces || [];
    }

    async createWorkspace(data: { name: string; ownerId: string; settings?: Record<string, any> }): Promise<WorkspaceResponse> {
        return await firstValueFrom(this.databaseService.createWorkspace({
            name: data.name,
            owner_id: data.ownerId,
            settings_json: data.settings ? JSON.stringify(data.settings) : undefined,
        }));
    }

    async updateWorkspace(id: string, data: { name?: string; settings?: Record<string, any> }): Promise<WorkspaceResponse> {
        return await firstValueFrom(this.databaseService.updateWorkspace({
            id,
            name: data.name,
            settings_json: data.settings !== undefined ? JSON.stringify(data.settings) : undefined,
        }));
    }

    async deleteWorkspace(id: string): Promise<void> {
        await firstValueFrom(this.databaseService.deleteWorkspace({ id }));
    }

    async addWorkspaceUser(workspaceId: string, userId: string, role: string): Promise<WorkspaceUserResponse> {
        return await firstValueFrom(this.databaseService.addWorkspaceUser({
            workspace_id: workspaceId,
            user_id: userId,
            role,
        }));
    }

    async removeWorkspaceUser(workspaceId: string, userId: string): Promise<void> {
        await firstValueFrom(this.databaseService.removeWorkspaceUser({
            workspace_id: workspaceId,
            user_id: userId,
        }));
    }

    async listWorkspaceUsers(workspaceId: string): Promise<WorkspaceUserResponse[]> {
        const result = await firstValueFrom(this.databaseService.listWorkspaceUsers({ workspace_id: workspaceId }));
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

    async getSourceByExternalId(type: string, externalId: string): Promise<SourceResponse | null> {
        try {
            return await firstValueFrom(this.databaseService.getSourceByExternalId({ type, external_id: externalId }));
        } catch (error: any) {
            if (error.code === 5) return null;
            throw error;
        }
    }

    async listSources(params?: { limit?: number; offset?: number; type?: string; activeOnly?: boolean }): Promise<{ items: SourceResponse[]; total: number }> {
        const result = await firstValueFrom(this.databaseService.listSources({
            limit: params?.limit,
            offset: params?.offset,
            type: params?.type,
            active_only: params?.activeOnly,
        }));
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
        return await firstValueFrom(this.databaseService.createSource({
            type: data.type,
            external_id: data.externalId,
            name: data.name,
            description: data.description,
            avatar_url: data.avatarUrl,
            url: data.url,
            language: data.language,
            metadata_json: data.metadata ? JSON.stringify(data.metadata) : undefined,
        }));
    }

    async updateSource(id: string, data: {
        name?: string;
        description?: string;
        avatarUrl?: string;
        url?: string;
        isActive?: boolean;
        language?: string;
        metadata?: Record<string, any>;
        lastSyncAt?: string;
    }): Promise<SourceResponse> {
        return await firstValueFrom(this.databaseService.updateSource({
            id,
            name: data.name,
            description: data.description,
            avatar_url: data.avatarUrl,
            url: data.url,
            language: data.language,
            metadata_json: data.metadata !== undefined ? JSON.stringify(data.metadata) : undefined,
            last_sync_at: data.lastSyncAt,
        }));
    }

    async setSourceActive(id: string, isActive: boolean): Promise<SourceResponse> {
        return await firstValueFrom(this.databaseService.setSourceActive({
            id,
            is_active: isActive,
        }));
    }

    async deleteSource(id: string): Promise<void> {
        await firstValueFrom(this.databaseService.deleteSource({ id }));
    }

    // ===================================
    // WORKSPACE DONOR METHODS
    // ===================================

    async addWorkspaceDonor(workspaceId: string, sourceId: string, settings?: Record<string, any>): Promise<WorkspaceDonorResponse> {
        return await firstValueFrom(this.databaseService.addWorkspaceDonor({
            workspace_id: workspaceId,
            source_id: sourceId,
            settings_json: settings ? JSON.stringify(settings) : undefined,
        }));
    }

    async removeWorkspaceDonor(workspaceId: string, sourceId: string): Promise<void> {
        await firstValueFrom(this.databaseService.removeWorkspaceDonor({
            workspace_id: workspaceId,
            source_id: sourceId,
        }));
    }

    async listWorkspaceDonors(workspaceId: string, activeOnly?: boolean): Promise<WorkspaceDonorResponse[]> {
        const result = await firstValueFrom(this.databaseService.listWorkspaceDonors({
            workspace_id: workspaceId,
            active_only: activeOnly,
        }));
        return result.donors || [];
    }

    async updateWorkspaceDonor(workspaceId: string, sourceId: string, data: { isActive?: boolean; settings?: Record<string, any> }): Promise<WorkspaceDonorResponse> {
        return await firstValueFrom(this.databaseService.updateWorkspaceDonor({
            workspace_id: workspaceId,
            source_id: sourceId,
            is_active: data.isActive,
            settings_json: data.settings !== undefined ? JSON.stringify(data.settings) : undefined,
        }));
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

    async listTargets(workspaceId: string, params?: { activeOnly?: boolean; type?: string }): Promise<{ targets: TargetResponse[]; total: number }> {
        const result = await firstValueFrom(this.databaseService.listTargets({
            workspace_id: workspaceId,
            active_only: params?.activeOnly,
            type: params?.type,
        }));
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
        return await firstValueFrom(this.databaseService.createTarget({
            workspace_id: data.workspaceId,
            type: data.type,
            external_id: data.externalId,
            name: data.name,
            description: data.description,
            language: data.language,
            timezone: data.timezone,
            max_posts_per_day: data.maxPostsPerDay,
            min_post_interval: data.minPostInterval,
            settings_json: data.settings ? JSON.stringify(data.settings) : undefined,
            work_schedule_json: data.workSchedule ? JSON.stringify(data.workSchedule) : undefined,
            account_id: data.accountId,
        }));
    }

    async updateTarget(id: string, data: {
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
    }): Promise<TargetResponse> {
        return await firstValueFrom(this.databaseService.updateTarget({
            id,
            name: data.name,
            description: data.description,
            language: data.language,
            timezone: data.timezone,
            max_posts_per_day: data.maxPostsPerDay,
            min_post_interval: data.minPostInterval,
            settings_json: data.settings !== undefined ? JSON.stringify(data.settings) : undefined,
            work_schedule_json: data.workSchedule !== undefined ? JSON.stringify(data.workSchedule) : undefined,
            account_id: data.accountId,
            is_active: data.isActive,
            metadata_json: data.metadata !== undefined ? JSON.stringify(data.metadata) : undefined,
        }));
    }

    async deleteTarget(id: string): Promise<void> {
        await firstValueFrom(this.databaseService.deleteTarget({ id }));
    }
}

