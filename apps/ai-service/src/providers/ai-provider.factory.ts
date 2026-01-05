
import { Injectable, BadRequestException } from '@nestjs/common';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { XAiProvider } from './xai/xai.provider';
import { OpenAiProvider } from './openai/openai.provider';

@Injectable()
export class AiProviderFactory {
    constructor(
        private readonly xAiProvider: XAiProvider,
        private readonly openAiProvider: OpenAiProvider,
    ) { }

    getProvider(providerType: string): AiProvider {
        switch (providerType.toLowerCase()) {
            case 'xai':
                return this.xAiProvider;
            case 'openai':
                return this.openAiProvider;
            default:
                throw new BadRequestException(`Unsupported AI provider: ${providerType}`);
        }
    }

    getEmbeddingProvider(): AiProvider {
        // OpenAI is the default embedding provider
        return this.openAiProvider;
    }
}
