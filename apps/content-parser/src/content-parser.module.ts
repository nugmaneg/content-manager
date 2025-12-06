import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'
import { ContentParserController } from './content-parser.controller';
import { ContentParserService } from './content-parser.service';
import {SourcesModule} from "./sources/sources.module";
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
      ConfigModule.forRoot({isGlobal: true,}),
      QueuesModule,
      SourcesModule
  ],
  controllers: [ContentParserController],
  providers: [ContentParserService],
})
export class ContentParserModule {}
