import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseGrpcClient, TargetResponse } from '../grpc';
import { CreateTargetDto, UpdateTargetDto } from './dto';
import { UserFromToken } from '../auth';

@Injectable()
export class TargetsService {
    private readonly logger = new Logger(TargetsService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    async create(user: UserFromToken, workspaceId: string, dto: CreateTargetDto): Promise<TargetResponse> {
        await this.checkWorkspaceAccess(user, workspaceId);

        this.logger.log(`Creating target ${dto.type}:${dto.externalId} in workspace=${workspaceId} by user=${user.id}`);

        return this.dbClient.createTarget({
            workspaceId,
            type: dto.type,
            externalId: dto.externalId,
            name: dto.name,
            description: dto.description,
            language: dto.language,
            timezone: dto.timezone,
            maxPostsPerDay: dto.maxPostsPerDay,
            minPostInterval: dto.minPostInterval,
            settings: dto.settings,
            workSchedule: dto.workSchedule,
            accountId: dto.accountId,
        });
    }

    async findAll(user: UserFromToken, workspaceId: string, params?: { activeOnly?: boolean; type?: string }): Promise<{ targets: TargetResponse[]; total: number }> {
        await this.checkWorkspaceViewAccess(user, workspaceId);
        return this.dbClient.listTargets(workspaceId, params);
    }

    async findOne(user: UserFromToken, workspaceId: string, targetId: string): Promise<TargetResponse> {
        await this.checkWorkspaceViewAccess(user, workspaceId);

        const target = await this.dbClient.getTarget(targetId);
        if (!target) {
            throw new NotFoundException('Target not found');
        }

        // Verify target belongs to this workspace
        if (target.workspace_id !== workspaceId) {
            throw new NotFoundException('Target not found in this workspace');
        }

        return target;
    }

    async update(user: UserFromToken, workspaceId: string, targetId: string, dto: UpdateTargetDto): Promise<TargetResponse> {
        await this.checkWorkspaceAccess(user, workspaceId);

        // Verify target exists and belongs to workspace
        await this.findOne(user, workspaceId, targetId);

        this.logger.log(`Updating target ${targetId} in workspace=${workspaceId} by user=${user.id}`);

        return this.dbClient.updateTarget(targetId, {
            name: dto.name,
            description: dto.description,
            language: dto.language,
            timezone: dto.timezone,
            maxPostsPerDay: dto.maxPostsPerDay,
            minPostInterval: dto.minPostInterval,
            settings: dto.settings,
            workSchedule: dto.workSchedule,
            accountId: dto.accountId,
            isActive: dto.isActive,
            metadata: dto.metadata,
        });
    }

    async remove(user: UserFromToken, workspaceId: string, targetId: string): Promise<void> {
        await this.checkWorkspaceAccess(user, workspaceId);

        // Verify target exists and belongs to workspace
        await this.findOne(user, workspaceId, targetId);

        this.logger.log(`Deleting target ${targetId} from workspace=${workspaceId} by user=${user.id}`);
        await this.dbClient.deleteTarget(targetId);
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
