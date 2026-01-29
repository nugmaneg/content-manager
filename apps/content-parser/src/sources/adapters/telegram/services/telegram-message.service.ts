import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { Api } from 'telegram';
import BigInteger from 'big-integer';
import { TelegramApiMessageContract } from '@queue-contracts/telegram';

@Injectable()
export class TelegramMessageService {
  private readonly logger = new Logger(TelegramMessageService.name);

  constructor(private readonly telegram: TelegramService) {}

  /**
   * Resolves peer to an entity that GramJS can use.
   * Supports:
   * - Username (e.g., "durov" or "@durov")
   * - Numeric channel ID (e.g., "1234567890" or "-1001234567890")
   */
  private async resolvePeer(
    client: ReturnType<TelegramService['getClient']>,
    peer: string,
  ): Promise<Api.TypeInputPeer> {
    // Check if it's a numeric ID
    const numericMatch = peer.match(/^-?(\d+)$/);

    if (numericMatch) {
      let channelId = peer;

      // Handle raw channel ID (without -100 prefix)
      // Telegram channel IDs in the API use -100 prefix, but the raw ID is without it
      if (!peer.startsWith('-100') && !peer.startsWith('-')) {
        // It's a raw channel ID, we need to add -100 prefix for Telegram API
        channelId = `-100${peer}`;
      }

      this.logger.debug(`Resolving numeric peer: ${peer} -> ${channelId}`);

      try {
        // Try to get entity by numeric ID
        const entity = await client.getInputEntity(channelId);
        return entity;
      } catch (error) {
        // If that fails, try using PeerChannel directly
        const rawId = peer.replace(/^-100/, '').replace(/^-/, '');
        this.logger.debug(`Trying PeerChannel with raw ID: ${rawId}`);

        try {
          // Use getEntity to properly resolve the channel
          const entity = await client.getEntity(
            new Api.PeerChannel({ channelId: BigInteger(rawId) }),
          );
          return await client.getInputEntity(entity);
        } catch (innerError) {
          this.logger.error(
            `Failed to resolve channel ID ${peer}: ${innerError}`,
          );
          throw new Error(
            `Cannot resolve channel ID: ${peer}. Make sure the bot/user has access to this channel.`,
          );
        }
      }
    }

    // It's a username - remove @ if present
    const username = peer.startsWith('@') ? peer.slice(1) : peer;
    this.logger.debug(`Resolving username peer: ${username}`);

    return await client.getInputEntity(username);
  }

  /**
   * Удобный метод-обёртка для отправки сообщений.
   */
  async sendMessage(params: {
    peer: string;
    message: string;
    sessionName?: string;
  }): Promise<void> {
    const { peer, message, sessionName } = params;
    const client = this.telegram.getClient(sessionName);

    const entity = await this.resolvePeer(client, peer);
    await client.sendMessage(entity, { message });
  }

  /**
   * Конвертирует Api.Message в TelegramApiMessageContract.
   * Это необходимо для соблюдения контракта при передаче через очереди.
   */
  private convertToContract(message: Api.Message): TelegramApiMessageContract {
    return {
      id: message.id,
      date: message.date,
      message: message.message,
      peerId: message.peerId ? this.serializePeer(message.peerId) : undefined,
      fromId: message.fromId ? this.serializePeer(message.fromId) : undefined,
      out: message.out,
      mentioned: message.mentioned,
      mediaUnread: message.mediaUnread,
      silent: message.silent,
      post: message.post,
      fromScheduled: message.fromScheduled,
      legacy: message.legacy,
      editHide: message.editHide,
      pinned: message.pinned,
      noforwards: message.noforwards,
      media: message.media ? JSON.parse(JSON.stringify(message.media)) : undefined,
      views: message.views,
      forwards: message.forwards,
      editDate: message.editDate,
      postAuthor: message.postAuthor,
      groupedId: message.groupedId?.toString(),
      entities: message.entities?.map((e) => ({
        offset: e.offset,
        length: e.length,
        className: e.className,
      })),
      // Сохраняем полный сырой объект для возможности дальнейшего использования
      raw: JSON.parse(JSON.stringify(message)),
    };
  }

  /**
   * Сериализует Peer объект в простой объект для передачи через очереди
   */
  private serializePeer(peer: any): any {
    if (!peer) return undefined;

    return {
      className: peer.className,
      channelId: peer.channelId?.toString(),
      chatId: peer.chatId?.toString(),
      userId: peer.userId?.toString(),
    };
  }

  async getMessages(params: {
    peer: string;
    offsetId?: number;
    limit?: number;
    sessionName?: string;
  }): Promise<TelegramApiMessageContract[]> {
    const { peer, offsetId, limit = 50, sessionName } = params;
    const client = this.telegram.getClient(sessionName);

    this.logger.debug(
      `Getting messages from peer: ${peer}, limit: ${limit}, offsetId: ${offsetId}`,
    );

    const entity = await this.resolvePeer(client, peer);

    const messages = await client.getMessages(entity, {
      offsetId: offsetId,
      reverse: !!offsetId,
      limit: limit,
    });

    this.logger.debug(`Received ${messages.length} messages from ${peer}`);

    // Детальное логирование первого сообщения для отладки
    if (messages.length > 0) {
      const firstMsg = messages[0];
      this.logger.debug(
        `[TEXT_TRACE] First message from Telegram API:\n` +
        `  - ID: ${firstMsg.id}\n` +
        `  - Text length: ${firstMsg.message?.length || 0}\n` +
        `  - Text preview: ${firstMsg.message?.substring(0, 100)}\n` +
        `  - Text type: ${typeof firstMsg.message}\n` +
        `  - Has media: ${!!firstMsg.media}`,
      );
    }

    // Конвертируем Api.Message[] в TelegramApiMessageContract[]
    return messages.map((msg) => this.convertToContract(msg));
  }
}
