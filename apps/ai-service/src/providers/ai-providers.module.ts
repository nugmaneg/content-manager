import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiProviderFactory } from './ai-provider.factory';
import { XAiProvider } from './xai/xai.provider';
import { OpenAiProvider } from './openai/openai.provider';
import { PromptsModule } from '../prompts/prompts.module';

@Module({
  imports: [ConfigModule, PromptsModule],
  providers: [XAiProvider, OpenAiProvider, AiProviderFactory],
  exports: [AiProviderFactory, OpenAiProvider],
})
export class AiProvidersModule {}
