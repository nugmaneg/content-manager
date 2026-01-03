import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, SourceResponse } from '../grpc';
import { CreateSourceDto, UpdateSourceDto } from './dto';
import { UserFromToken } from '../auth';

@Injectable()
export class SourcesService {
    private readonly logger = new Logger(SourcesService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    // FATHER and ADMIN can create sources
    async create(user: UserFromToken, dto: CreateSourceDto): Promise<SourceResponse> {
        this.checkAdminAccess(user);

        this.logger.log(`Creating source ${dto.type}:${dto.externalId} by user ${user.id}`);

        return this.dbClient.createSource({
            type: dto.type,
            externalId: dto.externalId,
            name: dto.name,
            description: dto.description,
            avatarUrl: dto.avatarUrl,
            url: dto.url,
            language: dto.language,
            metadata: dto.metadata,
        });
    }

    // All authenticated users can view sources
    async findAll(params?: { limit?: number; offset?: number; type?: string; activeOnly?: boolean }): Promise<{ items: SourceResponse[]; total: number }> {
        return this.dbClient.listSources(params);
    }

    async findOne(id: string): Promise<SourceResponse> {
        const source = await this.dbClient.getSource(id);
        if (!source) {
            throw new NotFoundException('Source not found');
        }
        return source;
    }

    async findByExternalId(type: string, externalId: string): Promise<SourceResponse | null> {
        return this.dbClient.getSourceByExternalId(type, externalId);
    }

    // FATHER and ADMIN can update sources (except isActive - use setActive for that)
    async update(user: UserFromToken, id: string, dto: UpdateSourceDto): Promise<SourceResponse> {
        this.checkAdminAccess(user);

        // Check source exists
        await this.findOne(id);

        return this.dbClient.updateSource(id, {
            name: dto.name,
            description: dto.description,
            avatarUrl: dto.avatarUrl,
            url: dto.url,
            language: dto.language,
            metadata: dto.metadata,
        });
    }

    // FATHER and ADMIN can activate/deactivate sources
    async setActive(user: UserFromToken, id: string, isActive: boolean): Promise<SourceResponse> {
        this.checkAdminAccess(user);

        // Check source exists
        await this.findOne(id);

        this.logger.log(`Setting source ${id} active=${isActive} by user ${user.id}`);
        return this.dbClient.setSourceActive(id, isActive);
    }

    // FATHER and ADMIN can delete sources
    async remove(user: UserFromToken, id: string): Promise<void> {
        this.checkAdminAccess(user);

        // Check source exists
        await this.findOne(id);

        await this.dbClient.deleteSource(id);
        this.logger.log(`Deleted source ${id} by user ${user.id}`);
    }

    // Helper: check if user is FATHER or ADMIN
    private checkAdminAccess(user: UserFromToken): void {
        if (user.role !== 'FATHER' && user.role !== 'ADMIN') {
            throw new ForbiddenException('Only FATHER and ADMIN can manage sources');
        }
    }
}
