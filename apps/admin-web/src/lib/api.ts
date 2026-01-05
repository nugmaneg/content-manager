const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RequestOptions extends RequestInit {
    token?: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { token, ...fetchOptions } = options;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...fetchOptions,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Auth
    async login(email: string, password: string) {
        return this.request<{ accessToken: string; refreshToken: string }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async register(email: string, password: string, name?: string) {
        return this.request<{ accessToken: string; refreshToken: string }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
    }

    async getProfile(token: string) {
        return this.request<{ id: string; email: string; name: string; role: string }>('/api/auth/me', { token });
    }

    // Sources
    async getSources(token: string, params?: { limit?: number; offset?: number; type?: string; activeOnly?: boolean }) {
        const searchParams = new URLSearchParams();
        if (params?.limit) searchParams.set('limit', params.limit.toString());
        if (params?.offset) searchParams.set('offset', params.offset.toString());
        if (params?.type) searchParams.set('type', params.type);
        if (params?.activeOnly) searchParams.set('activeOnly', 'true');
        const query = searchParams.toString() ? `?${searchParams}` : '';
        return this.request<{ items: Source[]; total: number }>(`/api/sources${query}`, { token });
    }

    async getSource(token: string, id: string) {
        return this.request<Source>(`/api/sources/${id}`, { token });
    }

    async createSource(token: string, data: CreateSourceData) {
        return this.request<Source>('/api/sources', {
            method: 'POST',
            body: JSON.stringify(data),
            token,
        });
    }

    async updateSource(token: string, id: string, data: UpdateSourceData) {
        return this.request<Source>(`/api/sources/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            token,
        });
    }

    async setSourceActive(token: string, id: string, isActive: boolean) {
        return this.request<Source>(`/api/sources/${id}/active`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive }),
            token,
        });
    }

    async deleteSource(token: string, id: string) {
        return this.request<void>(`/api/sources/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    async syncSource(token: string, id: string, limit?: number) {
        const query = limit ? `?limit=${limit}` : '';
        return this.request<SyncResult>(`/api/sources/${id}/sync${query}`, {
            method: 'POST',
            token,
        });
    }

    // Content
    async getContents(token: string, params?: { limit?: number; offset?: number; sourceId?: string; status?: string }) {
        const searchParams = new URLSearchParams();
        if (params?.limit) searchParams.set('limit', params.limit.toString());
        if (params?.offset) searchParams.set('offset', params.offset.toString());
        if (params?.sourceId) searchParams.set('sourceId', params.sourceId);
        if (params?.status) searchParams.set('status', params.status);
        const query = searchParams.toString() ? `?${searchParams}` : '';
        return this.request<{ items: Content[]; total: number }>(`/api/content${query}`, { token });
    }

    async getContent(token: string, id: string) {
        return this.request<Content>(`/api/content/${id}`, { token });
    }
    // Workspaces
    async getWorkspaces(token: string) {
        return this.request<Workspace[]>('/api/workspaces', { token });
    }

    async getWorkspace(token: string, id: string) {
        return this.request<Workspace>(`/api/workspaces/${id}`, { token });
    }

    async createWorkspace(token: string, data: { name: string; settings?: Record<string, unknown> }) {
        return this.request<Workspace>('/api/workspaces', {
            method: 'POST',
            body: JSON.stringify(data),
            token,
        });
    }

    async updateWorkspace(token: string, id: string, data: { name?: string; settings?: Record<string, unknown> }) {
        return this.request<Workspace>(`/api/workspaces/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            token,
        });
    }

    async deleteWorkspace(token: string, id: string) {
        return this.request<void>(`/api/workspaces/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    // Workspace Donors
    async getWorkspaceDonors(token: string, workspaceId: string, activeOnly?: boolean) {
        const query = activeOnly ? '?activeOnly=true' : '';
        return this.request<WorkspaceDonor[]>(`/api/workspaces/${workspaceId}/donors${query}`, { token });
    }

    async addWorkspaceDonor(token: string, workspaceId: string, sourceId: string, settings?: Record<string, unknown>) {
        return this.request<WorkspaceDonor>(`/api/workspaces/${workspaceId}/donors`, {
            method: 'POST',
            body: JSON.stringify({ sourceId, settings }),
            token,
        });
    }

    async updateWorkspaceDonor(token: string, workspaceId: string, sourceId: string, data: { isActive?: boolean; settings?: Record<string, unknown> }) {
        return this.request<WorkspaceDonor>(`/api/workspaces/${workspaceId}/donors/${sourceId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            token,
        });
    }

    async removeWorkspaceDonor(token: string, workspaceId: string, sourceId: string) {
        return this.request<void>(`/api/workspaces/${workspaceId}/donors/${sourceId}`, {
            method: 'DELETE',
            token,
        });
    }

    // Targets
    async getTargets(token: string, workspaceId: string, params?: { activeOnly?: boolean; type?: string }) {
        const searchParams = new URLSearchParams();
        if (params?.activeOnly) searchParams.set('activeOnly', 'true');
        if (params?.type) searchParams.set('type', params.type);
        const query = searchParams.toString() ? `?${searchParams}` : '';
        return this.request<{ targets: Target[]; total: number }>(`/api/workspaces/${workspaceId}/targets${query}`, { token });
    }

    async getTarget(token: string, workspaceId: string, targetId: string) {
        return this.request<Target>(`/api/workspaces/${workspaceId}/targets/${targetId}`, { token });
    }

    async createTarget(token: string, workspaceId: string, data: CreateTargetData) {
        return this.request<Target>(`/api/workspaces/${workspaceId}/targets`, {
            method: 'POST',
            body: JSON.stringify(data),
            token,
        });
    }

    async updateTarget(token: string, workspaceId: string, targetId: string, data: UpdateTargetData) {
        return this.request<Target>(`/api/workspaces/${workspaceId}/targets/${targetId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            token,
        });
    }

    async deleteTarget(token: string, workspaceId: string, targetId: string) {
        return this.request<void>(`/api/workspaces/${workspaceId}/targets/${targetId}`, {
            method: 'DELETE',
            token,
        });
    }
}

// Types
export interface Source {
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
    created_at: string;
    updated_at: string;
}

export interface CreateSourceData {
    type: string;
    externalId: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
    url?: string;
    language?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateSourceData {
    name?: string;
    description?: string;
    avatarUrl?: string;
    url?: string;
    language?: string;
    metadata?: Record<string, unknown>;
}

export interface SyncResult {
    sourceId: string;
    sourceName: string;
    messagesProcessed: number;
    contentCreated: number;
    contentSkipped: number;
    errors: string[];
    startedAt: string;
    finishedAt: string;
    durationMs: number;
}

export interface Content {
    id: string;
    externalId: string;
    text: string;
    sourceId: string;
    receivedViaId: string;
    qdrantId: string;
    isVectorized: boolean; // Note: backend returns snake_case in raw response but core controller formats to camelCase
    embeddingModel: string;
    status: string;
    aiAnalysis: any;
    rawData: any;
    createdAt: string;
    updatedAt: string;
}

export interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    settings_json: string;
    created_at: string;
    updated_at: string;
}

export interface WorkspaceDonor {
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

export interface Target {
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

export interface CreateTargetData {
    type: string;
    externalId: string;
    name?: string;
    description?: string;
    language?: string;
    timezone?: string;
    maxPostsPerDay?: number;
    minPostInterval?: number;
    settings?: Record<string, unknown>;
    workSchedule?: Record<string, unknown>;
    accountId?: string;
}

export interface UpdateTargetData {
    name?: string;
    description?: string;
    language?: string;
    timezone?: string;
    maxPostsPerDay?: number;
    minPostInterval?: number;
    settings?: Record<string, unknown>;
    workSchedule?: Record<string, unknown>;
    accountId?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
}

export const api = new ApiClient(API_BASE_URL);
