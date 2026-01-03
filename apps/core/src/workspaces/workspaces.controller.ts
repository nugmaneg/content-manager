import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, AddWorkspaceUserDto } from './dto';
import { JwtAuthGuard, CurrentUser, UserFromToken } from '../auth';

@Controller('api/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
    constructor(private readonly workspacesService: WorkspacesService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@CurrentUser() user: UserFromToken, @Body() dto: CreateWorkspaceDto) {
        const workspace = await this.workspacesService.create(user.id, dto);
        return this.formatWorkspace(workspace);
    }

    @Get()
    async findAll(@CurrentUser() user: UserFromToken) {
        const workspaces = await this.workspacesService.findAll(user.id);
        return workspaces.map(this.formatWorkspace);
    }

    @Get(':id')
    async findOne(@CurrentUser() user: UserFromToken, @Param('id') id: string) {
        const workspace = await this.workspacesService.findOne(id, user.id);
        return this.formatWorkspace(workspace);
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Body() dto: UpdateWorkspaceDto,
    ) {
        const workspace = await this.workspacesService.update(id, user.id, dto);
        return this.formatWorkspace(workspace);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@CurrentUser() user: UserFromToken, @Param('id') id: string) {
        await this.workspacesService.remove(id, user.id);
    }

    // User management
    @Get(':id/users')
    async listUsers(@CurrentUser() user: UserFromToken, @Param('id') id: string) {
        const users = await this.workspacesService.listUsers(id, user.id);
        return users.map(u => ({
            id: u.id,
            userId: u.user_id,
            email: u.user_email,
            name: u.user_name,
            role: u.role,
            createdAt: u.created_at,
        }));
    }

    @Post(':id/users')
    @HttpCode(HttpStatus.CREATED)
    async addUser(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Body() dto: AddWorkspaceUserDto,
    ) {
        const workspaceUser = await this.workspacesService.addUser(id, user.id, dto);
        return {
            id: workspaceUser.id,
            userId: workspaceUser.user_id,
            email: workspaceUser.user_email,
            name: workspaceUser.user_name,
            role: workspaceUser.role,
            createdAt: workspaceUser.created_at,
        };
    }

    @Delete(':id/users/:userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeUser(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Param('userId') targetUserId: string,
    ) {
        await this.workspacesService.removeUser(id, user.id, targetUserId);
    }

    // Helper to format workspace response
    private formatWorkspace(workspace: any) {
        return {
            id: workspace.id,
            name: workspace.name,
            ownerId: workspace.owner_id,
            settings: workspace.settings_json ? JSON.parse(workspace.settings_json) : null,
            createdAt: workspace.created_at,
            updatedAt: workspace.updated_at,
        };
    }
}
