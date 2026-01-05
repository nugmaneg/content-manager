import { IsString, IsOptional, IsBoolean, IsObject, IsInt, Min, Max } from 'class-validator';

export class CreateTargetDto {
    @IsString()
    type: string;

    @IsString()
    externalId: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsString()
    timezone?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    maxPostsPerDay?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    minPostInterval?: number;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;

    @IsOptional()
    @IsObject()
    workSchedule?: Record<string, any>;

    @IsOptional()
    @IsString()
    accountId?: string;
}

export class UpdateTargetDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsString()
    timezone?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    maxPostsPerDay?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    minPostInterval?: number;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;

    @IsOptional()
    @IsObject()
    workSchedule?: Record<string, any>;

    @IsOptional()
    @IsString()
    accountId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
