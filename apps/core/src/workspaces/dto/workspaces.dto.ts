import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateWorkspaceDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;
}

export class UpdateWorkspaceDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;
}

export class AddWorkspaceUserDto {
    @IsString()
    userId: string;

    @IsString()
    role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}
