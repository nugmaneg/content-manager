import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { QueuesModule } from './queues/queues.module';
import { TelegramQueueController } from './telegram-queue.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), QueuesModule],
  controllers: [CoreController, TelegramQueueController],
  providers: [CoreService],
})
export class CoreModule {}
