import { Injectable } from '@nestjs/common';
import { GenerateTextPayload, AnalyzeTextPayload } from '@queue-contracts/ai';
import { AiProcessingProducer } from './queues/ai-processing.producer';

@Injectable()
export class AiServiceService {
  constructor(private readonly aiProcessingProducer: AiProcessingProducer) {}

  getHello(): string {
    return 'Hello World!';
  }

  enqueueGenerateText(
    body: GenerateTextPayload,
    waitForResult = true,
  ): Promise<string> {
    return this.aiProcessingProducer.enqueueGenerateText(body, waitForResult);
  }

  enqueueAnalyzeContent(body: AnalyzeTextPayload, waitForResult = true) {
    return this.aiProcessingProducer.enqueueAnalyzeContent(body, waitForResult);
  }
}
