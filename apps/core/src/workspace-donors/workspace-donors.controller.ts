import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkspaceDonorsService } from './workspace-donors.service';
import { AddWorkspaceDonorDto, UpdateWorkspaceDonorDto } from './dto';
import { JwtAuthGuard, CurrentUser, UserFromToken } from '../auth';

@UseGuards(JwtAuthGuard)
@Controller('api/workspaces/:workspaceId/donors')
export class WorkspaceDonorsController {
    constructor(private readonly donorsService: WorkspaceDonorsService) { }

    @Post()
    async addDonor(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Body() dto: AddWorkspaceDonorDto,
    ) {
        return this.donorsService.addDonor(user, workspaceId, dto);
    }

    @Get()
    async listDonors(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Query('activeOnly') activeOnly?: string,
    ) {
        const isActiveOnly = activeOnly === 'true';
        return this.donorsService.listDonors(user, workspaceId, isActiveOnly);
    }

    @Patch(':sourceId')
    async updateDonor(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Param('sourceId') sourceId: string,
        @Body() dto: UpdateWorkspaceDonorDto,
    ) {
        return this.donorsService.updateDonor(user, workspaceId, sourceId, dto);
    }

    @Delete(':sourceId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeDonor(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Param('sourceId') sourceId: string,
    ) {
        await this.donorsService.removeDonor(user, workspaceId, sourceId);
    }
}
