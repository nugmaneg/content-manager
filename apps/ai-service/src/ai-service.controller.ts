import { Controller, Post, Body, Get } from '@nestjs/common';
import { ContentInput } from '@queue-contracts/ai';
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
    private readonly orchestrator: AnalysisOrchestratorService,
  ) { }

  @Get()
  getHello(): string {
    return 'AI Service is running (Three-Stage Architecture)';
  }

  @Get('health')
  health() {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }

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
}
