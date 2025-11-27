import { Module } from '@nestjs/common';
import { ContentParserController } from './content-parser.controller';
import { ContentParserService } from './content-parser.service';

@Module({
  imports: [],
  controllers: [ContentParserController],
  providers: [ContentParserService],
})
export class ContentParserModule {}
