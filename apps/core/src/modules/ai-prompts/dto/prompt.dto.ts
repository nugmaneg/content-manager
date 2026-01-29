import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export enum PromptCategory {
  CLASSIFICATION = 'CLASSIFICATION',
  ANALYSIS = 'ANALYSIS',
  FACT_CHECK = 'FACT_CHECK',
  SYSTEM = 'SYSTEM',
  GENERATION = 'GENERATION',
  OTHER = 'OTHER',
}

export class CreatePromptDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  template: string;

  @IsString()
  provider: string;

  @IsEnum(PromptCategory)
  category: PromptCategory;

  @IsString()
  @IsOptional()
  modelSettings?: string;

  @IsString()
  @IsOptional()
  variantGroup?: string;

  @IsString()
  @IsOptional()
  variantName?: string;
}

export class UpdatePromptDto {
  @IsString()
  template: string;

  @IsString()
  @IsOptional()
  changeNote?: string;
}

export class PromptResponseDto {
  id: string;

  key: string;

  name: string;

  description?: string;

  template: string;

  provider: string;

  category: PromptCategory;

  version: number;

  isActive: boolean;

  usageCount: number;

  lastUsedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}
