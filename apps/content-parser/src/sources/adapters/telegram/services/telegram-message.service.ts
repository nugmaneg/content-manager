import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { Api } from 'telegram';
import BigInteger from 'big-integer';

@Injectable()
export class TelegramMessageService {
  private readonly logger = new Logger(TelegramMessageService.name);

  constructor(private readonly telegram: TelegramService) { }

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
            new Api.PeerChannel({ channelId: BigInteger(rawId) })
          );
          return await client.getInputEntity(entity);
        } catch (innerError) {
          this.logger.error(`Failed to resolve channel ID ${peer}: ${innerError}`);
          throw new Error(`Cannot resolve channel ID: ${peer}. Make sure the bot/user has access to this channel.`);
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

  async getMessages(params: {
    peer: string;
    offsetId?: number;
    limit?: number;
    sessionName?: string;
  }): Promise<Api.Message[]> {
    const { peer, offsetId, limit = 50, sessionName } = params;
    const client = this.telegram.getClient(sessionName);

    this.logger.debug(`Getting messages from peer: ${peer}, limit: ${limit}, offsetId: ${offsetId}`);

    const entity = await this.resolvePeer(client, peer);

    const messages = await client.getMessages(entity, {
      offsetId: offsetId,
      reverse: !!offsetId,
      limit: limit,
    });

    this.logger.debug(`Received ${messages.length} messages from ${peer}`);

    return messages as Api.Message[];
  }
}

