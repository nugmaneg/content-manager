import { Test, TestingModule } from '@nestjs/testing';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';
import { AiProcessingProducer } from './queues/ai-processing.producer';

describe('AiServiceController', () => {
  let aiServiceController: AiServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AiServiceController],
      providers: [
        AiServiceService,
        {
          provide: AiProcessingProducer,
          useValue: {
            enqueueGenerateText: jest.fn(),
            enqueueAnalyzeText: jest.fn(),
          },
        },
      ],
    }).compile();

    aiServiceController = app.get<AiServiceController>(AiServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(aiServiceController.getHello()).toBe('Hello World!');
    });
  });
});
