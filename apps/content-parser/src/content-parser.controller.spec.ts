import { Test, TestingModule } from '@nestjs/testing';
import { ContentParserController } from './content-parser.controller';
import { ContentParserService } from './content-parser.service';

describe('ContentParserController', () => {
  let contentParserController: ContentParserController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ContentParserController],
      providers: [ContentParserService],
    }).compile();

    contentParserController = app.get<ContentParserController>(
      ContentParserController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(contentParserController.getHello()).toBe('Hello World!');
    });
  });
});
