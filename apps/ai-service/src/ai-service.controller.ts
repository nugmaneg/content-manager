
import { Controller, Post, Body, Get } from '@nestjs/common';
import { AiServiceService } from './ai-service.service';
import {
  GenerateTextPayload,
  AnalyzeTextPayload,
} from '@queue-contracts/ai';

@Controller('ai')
export class AiServiceController {
  constructor(
    private readonly aiServiceService: AiServiceService,
  ) { }

  @Get()
  getHello(): string {
    return this.aiServiceService.getHello();
  }

  @Post('test/generate')
  async generateText(@Body() body: GenerateTextPayload) {
    return this.aiServiceService.enqueueGenerateText(body);
  }

  @Post('test/analyze')
  async analyzeText(@Body() body: AnalyzeTextPayload) {
    return this.aiServiceService.enqueueAnalyzeText(body);
  }
}
