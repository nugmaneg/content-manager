
import { Injectable, BadRequestException } from '@nestjs/common';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { XAiProvider } from './xai/xai.provider';

@Injectable()
export class AiProviderFactory {
    constructor(
        private readonly xAiProvider: XAiProvider,
        // Inject other providers here as they are implemented
    ) { }

    getProvider(providerType: string): AiProvider {
        switch (providerType.toLowerCase()) {
            case 'xai':
                return this.xAiProvider;
            // case 'openai': return this.openAiProvider;
            // case 'gemini': return this.geminiProvider;
            default:
                throw new BadRequestException(`Unsupported AI provider: ${providerType}`);
        }
    }
}
