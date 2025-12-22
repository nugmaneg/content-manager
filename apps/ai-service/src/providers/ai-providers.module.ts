
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiProviderFactory } from './ai-provider.factory';
import { XAiProvider } from './xai/xai.provider';

@Module({
    imports: [ConfigModule],
    providers: [
        XAiProvider,
        AiProviderFactory,
    ],
    exports: [AiProviderFactory],
})
export class AiProvidersModule { }
