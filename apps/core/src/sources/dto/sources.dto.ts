import { IsString, IsOptional, IsObject, IsIn, IsBoolean } from 'class-validator';

export class CreateSourceDto {
    @IsString()
    @IsIn(['telegram', 'twitter', 'rss', 'youtube', 'instagram'])
    type: string;

    @IsString()
    externalId: string;  // numeric ID for telegram

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @IsOptional()
    @IsString()
    url?: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;  // username for TG goes here
}

export class UpdateSourceDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @IsOptional()
    @IsString()
    url?: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class SetSourceActiveDto {
    @IsBoolean()
    isActive: boolean;
}
