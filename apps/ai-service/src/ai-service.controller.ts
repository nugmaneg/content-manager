import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AiServiceService } from './ai-service.service';
import {
  GenerateTextPayload,
  AnalyzeTextPayload,
  ContentInput,
} from '@queue-contracts/ai';
import { AnalysisOrchestratorService } from './orchestrator/analysis-orchestrator.service';

// DTO для упрощённого тестирования
interface QuickAnalyzeDto {
  text: string;
  provider?: string;
}

interface FullAnalyzeDto {
  input: ContentInput;
  provider?: string;
  forceFactCheck?: boolean;
  skipFactCheck?: boolean;
}

@Controller('ai')
export class AiServiceController {
  constructor(
    private readonly aiServiceService: AiServiceService,
    private readonly orchestrator: AnalysisOrchestratorService,
  ) { }

  @Get()
  getHello(): string {
    return this.aiServiceService.getHello();
  }

  @Get('health')
  health() {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }

  // ===========================================
  // QUEUE-BASED (через очередь)
  // ===========================================

  @Post('queue/generate')
  async enqueueGenerateText(@Body() body: GenerateTextPayload) {
    return this.aiServiceService.enqueueGenerateText(body);
  }

  @Post('queue/analyze')
  async enqueueAnalyzeContent(@Body() body: AnalyzeTextPayload) {
    return this.aiServiceService.enqueueAnalyzeContent(body);
  }

  // ===========================================
  // DIRECT (прямой вызов для тестирования)
  // ===========================================

  /**
   * Быстрый анализ текста (минимальный ввод)
   * POST /ai/analyze/quick
   * Body: { text: "...", provider?: "xai" }
   */
  @Post('analyze/quick')
  async quickAnalyze(@Body() body: QuickAnalyzeDto) {
    return this.orchestrator.quickAnalyzeContent(
      body.text,
      body.provider || 'xai',
    );
  }

  /**
   * Полный анализ контента (с ContentInput)
   * POST /ai/analyze/full
   * Body: { input: { text: "...", source: { platform: "telegram", ... } }, provider?: "xai", forceFactCheck?: false }
   */
  @Post('analyze/full')
  async fullAnalyze(@Body() body: FullAnalyzeDto) {
    return this.orchestrator.analyzeContent(
      body.input,
      body.provider || 'xai',
      undefined,
      body.forceFactCheck,
      body.skipFactCheck,
    );
  }

  // ===========================================
  // LEGACY (для обратной совместимости)
  // ===========================================

  /** @deprecated Use /ai/queue/generate */
  @Post('test/generate')
  async generateText(@Body() body: GenerateTextPayload) {
    return this.aiServiceService.enqueueGenerateText(body);
  }

  /** @deprecated Use /ai/queue/analyze or /ai/analyze/quick */
  @Post('test/analyze')
  async analyzeContent(@Body() body: AnalyzeTextPayload) {
    return this.aiServiceService.enqueueAnalyzeContent(body);
  }
}
