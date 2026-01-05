import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class AddWorkspaceDonorDto {
    @IsString()
    sourceId: string;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;
}

export class UpdateWorkspaceDonorDto {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;
}
