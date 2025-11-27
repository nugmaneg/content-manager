import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentParserService {
  getHello(): string {
    return 'Hello World!';
  }
}
