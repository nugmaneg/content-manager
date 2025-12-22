import { Injectable } from '@nestjs/common';
import {
  AnalyzeTextPayload,
  GenerateTextPayload,
} from '@queue-contracts/ai';
import { AiProcessingProducer } from './queues/ai-processing.producer';

@Injectable()
export class AiServiceService {
  constructor(
    private readonly aiProcessingProducer: AiProcessingProducer,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  enqueueGenerateText(body: GenerateTextPayload, waitForResult = true): Promise<string> {
    return this.aiProcessingProducer.enqueueGenerateText(body, waitForResult);
  }

  enqueueAnalyzeText(body: AnalyzeTextPayload) {
    return this.aiProcessingProducer.enqueueAnalyzeText(body);
  }
}
