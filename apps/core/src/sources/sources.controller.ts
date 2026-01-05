import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { SourceSyncOrchestrator } from './sync/source-sync-orchestrator.service';
import { CreateSourceDto, UpdateSourceDto, SetSourceActiveDto } from './dto';
import { JwtAuthGuard, CurrentUser, UserFromToken } from '../auth';

@Controller('api/sources')
@UseGuards(JwtAuthGuard)
export class SourcesController {
    private readonly logger = new Logger(SourcesController.name);

    constructor(
        private readonly sourcesService: SourcesService,
        private readonly syncOrchestrator: SourceSyncOrchestrator,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@CurrentUser() user: UserFromToken, @Body() dto: CreateSourceDto) {
        const source = await this.sourcesService.create(user, dto);
        return this.formatSource(source);
    }

    @Get()
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('type') type?: string,
        @Query('activeOnly') activeOnly?: string,
    ) {
        const result = await this.sourcesService.findAll({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            type,
            activeOnly: activeOnly === 'true',
        });
        return {
            items: result.items.map(this.formatSource),
            total: result.total,
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const source = await this.sourcesService.findOne(id);
        return this.formatSource(source);
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Body() dto: UpdateSourceDto,
    ) {
        const source = await this.sourcesService.update(user, id, dto);
        return this.formatSource(source);
    }

    @Patch(':id/active')
    async setActive(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Body() dto: SetSourceActiveDto,
    ) {
        const source = await this.sourcesService.setActive(user, id, dto.isActive);
        return this.formatSource(source);
    }

    @Post(':id/sync')
    @HttpCode(HttpStatus.OK)
    async syncSource(
        @CurrentUser() user: UserFromToken,
        @Param('id') id: string,
        @Query('limit') limit?: string,
    ) {
        // Check admin access
        if (user.role !== 'FATHER' && user.role !== 'ADMIN') {
            throw new Error('Only FATHER and ADMIN can sync sources');
        }

        this.logger.log(`Sync requested for source ${id} by user ${user.id}, limit=${limit}`);

        // Делегировать оркестратору - он сам определит тип источника
        return await this.syncOrchestrator.syncSource(id, {
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@CurrentUser() user: UserFromToken, @Param('id') id: string) {
        await this.sourcesService.remove(user, id);
    }

    // Helper to format source response (snake_case -> camelCase)
    private formatSource(source: any) {
        return {
            id: source.id,
            type: source.type,
            externalId: source.external_id,
            name: source.name || null,
            description: source.description || null,
            avatarUrl: source.avatar_url || null,
            url: source.url || null,
            isActive: source.is_active,
            language: source.language || null,
            metadata: source.metadata_json ? JSON.parse(source.metadata_json) : null,
            lastSyncAt: source.last_sync_at || null,
            createdAt: source.created_at,
            updatedAt: source.updated_at,
        };
    }
}
