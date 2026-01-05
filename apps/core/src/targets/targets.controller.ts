import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { CreateTargetDto, UpdateTargetDto } from './dto';
import { JwtAuthGuard, CurrentUser, UserFromToken } from '../auth';

@UseGuards(JwtAuthGuard)
@Controller('api/workspaces/:workspaceId/targets')
export class TargetsController {
    constructor(private readonly targetsService: TargetsService) { }

    @Post()
    async create(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Body() dto: CreateTargetDto,
    ) {
        return this.targetsService.create(user, workspaceId, dto);
    }

    @Get()
    async findAll(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Query('activeOnly') activeOnly?: string,
        @Query('type') type?: string,
    ) {
        return this.targetsService.findAll(user, workspaceId, {
            activeOnly: activeOnly === 'true',
            type,
        });
    }

    @Get(':targetId')
    async findOne(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Param('targetId') targetId: string,
    ) {
        return this.targetsService.findOne(user, workspaceId, targetId);
    }

    @Patch(':targetId')
    async update(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Param('targetId') targetId: string,
        @Body() dto: UpdateTargetDto,
    ) {
        return this.targetsService.update(user, workspaceId, targetId, dto);
    }

    @Delete(':targetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @CurrentUser() user: UserFromToken,
        @Param('workspaceId') workspaceId: string,
        @Param('targetId') targetId: string,
    ) {
        await this.targetsService.remove(user, workspaceId, targetId);
    }
}
