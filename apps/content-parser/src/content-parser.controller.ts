import { Controller, Get } from '@nestjs/common';
import { ContentParserService } from './content-parser.service';

@Controller()
export class ContentParserController {
  constructor(private readonly contentParserService: ContentParserService) { }

  @Get()
  getHello(): string {
    return this.contentParserService.getHello();
  }

  @Get('health')
  health() {
    return 'OK';
  }
}
