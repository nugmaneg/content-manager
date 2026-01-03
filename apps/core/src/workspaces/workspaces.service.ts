import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, WorkspaceResponse, WorkspaceUserResponse } from '../grpc';
import { CreateWorkspaceDto, UpdateWorkspaceDto, AddWorkspaceUserDto } from './dto';

@Injectable()
export class WorkspacesService {
    private readonly logger = new Logger(WorkspacesService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    async create(ownerId: string, dto: CreateWorkspaceDto): Promise<WorkspaceResponse> {
        this.logger.log(`Creating workspace "${dto.name}" for user ${ownerId}`);
        return this.dbClient.createWorkspace({
            name: dto.name,
            ownerId,
            settings: dto.settings,
        });
    }

    async findAll(userId: string): Promise<WorkspaceResponse[]> {
        return this.dbClient.listWorkspaces(userId);
    }

    async findOne(id: string, userId: string): Promise<WorkspaceResponse> {
        const workspace = await this.dbClient.getWorkspace(id);
        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        // Check access
        await this.checkAccess(id, userId);

        return workspace;
    }

    async update(id: string, userId: string, dto: UpdateWorkspaceDto): Promise<WorkspaceResponse> {
        // Check ownership or admin access
        await this.checkOwnerOrAdmin(id, userId);

        return this.dbClient.updateWorkspace(id, {
            name: dto.name,
            settings: dto.settings,
        });
    }

    async remove(id: string, userId: string): Promise<void> {
        // Only owner can delete
        await this.checkOwner(id, userId);

        await this.dbClient.deleteWorkspace(id);
        this.logger.log(`Workspace ${id} deleted by user ${userId}`);
    }

    // User management
    async addUser(workspaceId: string, currentUserId: string, dto: AddWorkspaceUserDto): Promise<WorkspaceUserResponse> {
        await this.checkOwnerOrAdmin(workspaceId, currentUserId);

        return this.dbClient.addWorkspaceUser(workspaceId, dto.userId, dto.role);
    }

    async removeUser(workspaceId: string, currentUserId: string, targetUserId: string): Promise<void> {
        await this.checkOwnerOrAdmin(workspaceId, currentUserId);

        // Can't remove owner
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (workspace?.owner_id === targetUserId) {
            throw new ForbiddenException('Cannot remove workspace owner');
        }

        await this.dbClient.removeWorkspaceUser(workspaceId, targetUserId);
    }

    async listUsers(workspaceId: string, userId: string): Promise<WorkspaceUserResponse[]> {
        await this.checkAccess(workspaceId, userId);
        return this.dbClient.listWorkspaceUsers(workspaceId);
    }

    // Access control helpers
    private async checkAccess(workspaceId: string, userId: string): Promise<void> {
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (!workspace) throw new NotFoundException('Workspace not found');

        // Owner has access
        if (workspace.owner_id === userId) return;

        // Check if user is a member
        const users = await this.dbClient.listWorkspaceUsers(workspaceId);
        const isMember = users.some(u => u.user_id === userId);

        if (!isMember) {
            throw new ForbiddenException('Access denied to this workspace');
        }
    }

    private async checkOwner(workspaceId: string, userId: string): Promise<void> {
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (!workspace) throw new NotFoundException('Workspace not found');

        if (workspace.owner_id !== userId) {
            throw new ForbiddenException('Only workspace owner can perform this action');
        }
    }

    private async checkOwnerOrAdmin(workspaceId: string, userId: string): Promise<void> {
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (!workspace) throw new NotFoundException('Workspace not found');

        // Owner can do anything
        if (workspace.owner_id === userId) return;

        // Check if user is admin
        const users = await this.dbClient.listWorkspaceUsers(workspaceId);
        const userMembership = users.find(u => u.user_id === userId);

        if (!userMembership || userMembership.role !== 'ADMIN') {
            throw new ForbiddenException('Admin access required');
        }
    }
}
