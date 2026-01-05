
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiProviderFactory } from './ai-provider.factory';
import { XAiProvider } from './xai/xai.provider';
import { OpenAiProvider } from './openai/openai.provider';

@Module({
    imports: [ConfigModule],
    providers: [
        XAiProvider,
        OpenAiProvider,
        AiProviderFactory,
    ],
    exports: [AiProviderFactory, OpenAiProvider],
})
export class AiProvidersModule { }
