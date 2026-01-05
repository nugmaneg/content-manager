import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseGrpcClient, WorkspaceDonorResponse } from '../grpc';
import { AddWorkspaceDonorDto, UpdateWorkspaceDonorDto } from './dto';
import { UserFromToken } from '../auth';

@Injectable()
export class WorkspaceDonorsService {
    private readonly logger = new Logger(WorkspaceDonorsService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    async addDonor(user: UserFromToken, workspaceId: string, dto: AddWorkspaceDonorDto): Promise<WorkspaceDonorResponse> {
        await this.checkWorkspaceAccess(user, workspaceId);

        this.logger.log(`Adding donor source=${dto.sourceId} to workspace=${workspaceId} by user=${user.id}`);
        return this.dbClient.addWorkspaceDonor(workspaceId, dto.sourceId, dto.settings);
    }

    async removeDonor(user: UserFromToken, workspaceId: string, sourceId: string): Promise<void> {
        await this.checkWorkspaceAccess(user, workspaceId);

        this.logger.log(`Removing donor source=${sourceId} from workspace=${workspaceId} by user=${user.id}`);
        await this.dbClient.removeWorkspaceDonor(workspaceId, sourceId);
    }

    async listDonors(user: UserFromToken, workspaceId: string, activeOnly?: boolean): Promise<WorkspaceDonorResponse[]> {
        // Check user has access to workspace (is owner or member)
        await this.checkWorkspaceViewAccess(user, workspaceId);

        return this.dbClient.listWorkspaceDonors(workspaceId, activeOnly);
    }

    async updateDonor(user: UserFromToken, workspaceId: string, sourceId: string, dto: UpdateWorkspaceDonorDto): Promise<WorkspaceDonorResponse> {
        await this.checkWorkspaceAccess(user, workspaceId);

        this.logger.log(`Updating donor source=${sourceId} in workspace=${workspaceId} by user=${user.id}`);
        return this.dbClient.updateWorkspaceDonor(workspaceId, sourceId, {
            isActive: dto.isActive,
            settings: dto.settings,
        });
    }

    // Check user can modify workspace (owner or ADMIN member)
    private async checkWorkspaceAccess(user: UserFromToken, workspaceId: string): Promise<void> {
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        // Owner always has access
        if (workspace.owner_id === user.id) return;

        // FATHER/ADMIN role has access to all workspaces
        if (user.role === 'FATHER' || user.role === 'ADMIN') return;

        // Check if user is ADMIN member of this workspace
        const members = await this.dbClient.listWorkspaceUsers(workspaceId);
        const membership = members.find(m => m.user_id === user.id);

        if (!membership || membership.role !== 'ADMIN') {
            throw new ForbiddenException('You do not have permission to modify this workspace');
        }
    }

    // Check user can view workspace (owner or any member)
    private async checkWorkspaceViewAccess(user: UserFromToken, workspaceId: string): Promise<void> {
        const workspace = await this.dbClient.getWorkspace(workspaceId);
        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        // Owner always has access
        if (workspace.owner_id === user.id) return;

        // FATHER/ADMIN role has access to all workspaces
        if (user.role === 'FATHER' || user.role === 'ADMIN') return;

        // Check if user is member of this workspace
        const members = await this.dbClient.listWorkspaceUsers(workspaceId);
        const membership = members.find(m => m.user_id === user.id);

        if (!membership) {
            throw new ForbiddenException('You do not have access to this workspace');
        }
    }
}
