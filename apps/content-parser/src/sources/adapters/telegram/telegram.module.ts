import {
    DynamicModule,
    FactoryProvider,
    Inject,
    Logger,
    Module,
    ModuleMetadata,
    OnApplicationShutdown,
    Provider,
} from '@nestjs/common';
import {TelegramModuleOptions} from './telegram.types';
import {TELEGRAM_CLIENTS, TELEGRAM_MODULE_OPTIONS} from './telegram.tokens';
import {TelegramClientsMap, telegramClientsProvider} from './telegram.provider';
import {TelegramService} from './telegram.service';
import {TelegramProcessor} from './processors/telegram.processor';

type TelegramModuleAsyncOptions = {
    imports?: ModuleMetadata['imports'];
    inject?: FactoryProvider['inject'];
    services?: ModuleMetadata['providers'];
    useFactory: (...args: any[]) => Promise<TelegramModuleOptions> | TelegramModuleOptions;
};

@Module({})
export class TelegramModule implements OnApplicationShutdown {
    private readonly logger = new Logger(TelegramModule.name);

    constructor(
        @Inject(TELEGRAM_CLIENTS)
        private readonly clients: TelegramClientsMap,
    ) {}

    static registerAsync(options: TelegramModuleAsyncOptions): DynamicModule {
        const asyncOptionsProvider: Provider = {
            provide: TELEGRAM_MODULE_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject ?? [],
        };

        return {
            module: TelegramModule ,
            imports: [
                ... (options.imports ?? []),
            ],
            providers: [
                asyncOptionsProvider,
                telegramClientsProvider,
                TelegramService,
                TelegramProcessor,
                ...(options.services ?? []),
            ],
            exports: [
                TELEGRAM_CLIENTS,
                TelegramService,
                TelegramModule,
                ...(options.services ?? []),
            ],
        };
    }

    async onApplicationShutdown() {
        if (!this.clients || this.clients.size === 0) {
            return;
        }

        this.logger.log(`Shutting down ${this.clients.size} Telegram session(s)...`);

        const disconnectPromises = Array.from(this.clients.entries()).map(async ([sessionName, client]) => {
            try {
                if (client && client.connected) {
                    await client.disconnect();
                    this.logger.log(`Telegram session "${sessionName}" disconnected successfully`);
                } else {
                    this.logger.debug(`Telegram session "${sessionName}" was not connected`);
                }
            } catch (error) {
                this.logger.error(`Error disconnecting Telegram session "${sessionName}":`, error);
            }
        });

        await Promise.allSettled(disconnectPromises);
        this.logger.log('All Telegram sessions shutdown completed');
    }

}
