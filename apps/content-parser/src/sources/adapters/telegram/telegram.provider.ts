import {Logger, Provider} from '@nestjs/common';
import {Api, TelegramClient} from 'telegram';
import {StringSession} from 'telegram/sessions';
import {TelegramModuleOptions} from './telegram.types';
import {TELEGRAM_CLIENTS, TELEGRAM_MODULE_OPTIONS} from './telegram.tokens';


export type TelegramClientsMap = Map<string, TelegramClient>;

export const telegramClientsProvider: Provider = {
    provide: TELEGRAM_CLIENTS,
    inject: [TELEGRAM_MODULE_OPTIONS],
    useFactory: async (options: TelegramModuleOptions): Promise<TelegramClientsMap> => {
        const clients: TelegramClientsMap = new Map();

        for (const session of options.sessions) {
            const {apiId, apiHash, sessionString, connection, name} = session;

            const stringSession = new StringSession(sessionString);

            const client = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: connection?.connectionRetries ?? 5,
            });

            const isConnected = await client.connect();
            if (isConnected) {
                const me = (await client.getMe()) as Api.User;
                Logger.log(
                    `Telegram session "${name}" connected successfully!
                    UserID: ${me.id}
                    Username: ${me.username}
                    Name: ${me.firstName} ${me.lastName}
                    Phone: ${me.phone}`,
                );
            } else {
                Logger.error(`Telegram session "${name}" not connected!\n`);
            }

            clients.set(name, client);
        }

        return clients;
    },
};
