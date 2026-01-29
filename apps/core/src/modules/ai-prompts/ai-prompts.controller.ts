import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { AiPromptsService } from './ai-prompts.service';
import {
  CreatePromptDto,
  UpdatePromptDto,
  PromptCategory,
} from './dto/prompt.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/ai-prompts')
@UseGuards(JwtAuthGuard)
export class AiPromptsController {
  constructor(private readonly promptsService: AiPromptsService) {}

  @Get()
  async listPrompts(
    @Query('provider') provider?: string,
    @Query('category') category?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const active = activeOnly === 'true';
    return this.promptsService.listPrompts(provider, category, active);
  }

  @Get('key/:key')
  async getPromptByKey(@Param('key') key: string) {
    return this.promptsService.getPromptByKey(key);
  }

  @Get(':id')
  async getPromptById(@Param('id') id: string) {
    return this.promptsService.getPromptById(id);
  }

  @Post()
  async createPrompt(@Body() dto: CreatePromptDto, @Request() req: any) {
    return this.promptsService.createPrompt(dto, req.user?.userId);
  }

  @Put(':id')
  async updatePrompt(
    @Param('id') id: string,
    @Body() dto: UpdatePromptDto,
    @Request() req: any,
  ) {
    return this.promptsService.updatePrompt(id, dto, req.user?.userId);
  }

  @Patch(':id/toggle')
  async toggleActiveStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.promptsService.toggleActiveStatus(id, isActive);
  }

  @Get(':id/versions')
  async getPromptVersions(@Param('id') id: string) {
    return this.promptsService.getPromptVersions(id);
  }

  @Delete(':id')
  async deletePrompt(@Param('id') id: string) {
    return this.promptsService.deletePrompt(id);
  }
}
