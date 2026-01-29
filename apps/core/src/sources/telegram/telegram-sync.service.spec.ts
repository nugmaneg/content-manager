import { Test, TestingModule } from '@nestjs/testing';
import { TelegramSyncService } from './telegram-sync.service';
import { DatabaseGrpcClient } from '../../grpc';
import { TelegramParseProducer } from '../../queues/telegram-parse.producer';
import { ContentPipelineProducer } from '../../pipeline/content';

describe('TelegramSyncService', () => {
  let service: TelegramSyncService;
  let dbClient: jest.Mocked<DatabaseGrpcClient>;
  let telegramProducer: jest.Mocked<TelegramParseProducer>;
  let contentPipelineProducer: jest.Mocked<ContentPipelineProducer>;

  const mockSource = {
    id: 'source-1',
    name: 'Test Channel',
    type: 'telegram',
    external_id: '1234567890',
    metadata_json: JSON.stringify({ username: 'test_channel' }),
  };

  const mockMessages = [
    {
      id: 1,
      message: 'Test message 1',
      date: 1704067200, // 2024-01-01
      views: 100,
      forwards: 5,
      edit_date: undefined,
      media: undefined,
    },
    {
      id: 2,
      message: 'Test message 2 with URL https://example.com',
      date: 1704153600, // 2024-01-02
      views: 200,
      forwards: 10,
      edit_date: undefined,
      media: undefined,
    },
    {
      id: 3,
      message: '', // Empty message
      date: 1704240000,
      views: 0,
      forwards: 0,
      edit_date: undefined,
      media: undefined,
    },
  ];

  beforeEach(async () => {
    const mockDbClient = {
      getSource: jest.fn(),
      createRawContent: jest.fn(),
      updateSource: jest.fn(),
    };

    const mockTelegramProducer = {
      getMessagesJob: jest.fn(),
    };

    const mockContentPipelineProducer = {
      enqueueRawContent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramSyncService,
        {
          provide: DatabaseGrpcClient,
          useValue: mockDbClient,
        },
        {
          provide: TelegramParseProducer,
          useValue: mockTelegramProducer,
        },
        {
          provide: ContentPipelineProducer,
          useValue: mockContentPipelineProducer,
        },
      ],
    }).compile();

    service = module.get<TelegramSyncService>(TelegramSyncService);
    dbClient = module.get(DatabaseGrpcClient);
    telegramProducer = module.get(TelegramParseProducer);
    contentPipelineProducer = module.get(ContentPipelineProducer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncSource', () => {
    it('should successfully sync telegram source', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: mockMessages,
      });

      dbClient.createRawContent.mockResolvedValueOnce({
        id: 'raw-1',
        text: 'Test message 1',
        sourceId: 'source-1',
        externalId: '1234567890:1',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      dbClient.createRawContent.mockResolvedValueOnce({
        id: 'raw-2',
        text: 'Test message 2 with URL https://example.com',
        sourceId: 'source-1',
        externalId: '1234567890:2',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      contentPipelineProducer.enqueueRawContent.mockResolvedValue('job-1');
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      const result = await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(dbClient.getSource).toHaveBeenCalledWith('source-1');
      expect(telegramProducer.getMessagesJob).toHaveBeenCalledWith({
        peer: 'test_channel',
        limit: 50,
        offsetId: 0,
      });
      expect(dbClient.createRawContent).toHaveBeenCalledTimes(2); // 2 valid messages
      expect(contentPipelineProducer.enqueueRawContent).toHaveBeenCalledTimes(2);
      expect(dbClient.updateSource).toHaveBeenCalled();

      expect(result.messagesProcessed).toBe(3);
      expect(result.contentCreated).toBe(2);
      expect(result.contentSkipped).toBe(1); // 1 empty message
      expect(result.errors).toHaveLength(0);
    });

    it('should throw error if source not found', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(null);

      // Act & Assert
      await expect(service.syncSource('non-existent', { limit: 50 })).rejects.toThrow(
        'Source not found: non-existent',
      );
    });

    it('should throw error if source type is not telegram', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue({
        ...mockSource,
        type: 'twitter',
      });

      // Act & Assert
      await expect(service.syncSource('source-1', { limit: 50 })).rejects.toThrow(
        'TelegramSyncService can only sync telegram sources, got: twitter',
      );
    });

    it('should skip empty messages', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [{ id: 1, message: '', date: 1704067200 }],
      });
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      const result = await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(dbClient.createRawContent).not.toHaveBeenCalled();
      expect(result.contentCreated).toBe(0);
      expect(result.contentSkipped).toBe(1);
    });

    it('should handle duplicate messages (already exists error)', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [mockMessages[0]],
      });

      const duplicateError = new Error('already exists');
      (duplicateError as any).code = 6;
      dbClient.createRawContent.mockRejectedValue(duplicateError);
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      const result = await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(result.contentCreated).toBe(0);
      expect(result.contentSkipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should track errors for failed messages', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [mockMessages[0]],
      });

      dbClient.createRawContent.mockRejectedValue(new Error('Database error'));
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      const result = await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(result.contentCreated).toBe(0);
      expect(result.contentSkipped).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });

    it('should extract URLs from message text', async () => {
      // Arrange
      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [mockMessages[1]], // Message with URL
      });

      dbClient.createRawContent.mockResolvedValue({
        id: 'raw-1',
        text: mockMessages[1].message,
        sourceId: 'source-1',
        externalId: '1234567890:2',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      contentPipelineProducer.enqueueRawContent.mockResolvedValue('job-1');
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(dbClient.createRawContent).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: ['https://example.com'],
        }),
      );
    });

    it('should use external_id as peer if username not in metadata', async () => {
      // Arrange
      const sourceWithoutUsername = {
        ...mockSource,
        metadata_json: JSON.stringify({}),
      };

      dbClient.getSource.mockResolvedValue(sourceWithoutUsername);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [mockMessages[0]],
      });

      dbClient.createRawContent.mockResolvedValue({
        id: 'raw-1',
        text: mockMessages[0].message,
        sourceId: 'source-1',
        externalId: '1234567890:1',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      contentPipelineProducer.enqueueRawContent.mockResolvedValue('job-1');
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(telegramProducer.getMessagesJob).toHaveBeenCalledWith({
        peer: '1234567890', // Should use external_id
        limit: 50,
        offsetId: 0,
      });
    });

    it('should preserve text encoding through the sync process', async () => {
      // Arrange
      const messageWithSpecialChars = {
        id: 4,
        message: 'Text with emoji 🚀 and unicode: привет мир 你好世界',
        date: 1704067200,
        views: 100,
        forwards: 5,
        edit_date: undefined,
        media: undefined,
      };

      dbClient.getSource.mockResolvedValue(mockSource);
      telegramProducer.getMessagesJob.mockResolvedValue({
        status: 'received',
        messages: [messageWithSpecialChars],
      });

      dbClient.createRawContent.mockImplementation(async (data) => ({
        id: 'raw-1',
        text: data.text, // Return the same text
        sourceId: data.sourceId,
        externalId: data.externalId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      contentPipelineProducer.enqueueRawContent.mockResolvedValue('job-1');
      dbClient.updateSource.mockResolvedValue(undefined);

      // Act
      await service.syncSource('source-1', { limit: 50 });

      // Assert
      expect(dbClient.createRawContent).toHaveBeenCalledWith(
        expect.objectContaining({
          text: messageWithSpecialChars.message,
        }),
      );
    });
  });
});
