import { Body, Controller, Post } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

export class ProcessChannelDto {
    channel: string;
    limit?: number;
}

@Controller('pipeline')
export class PipelineController {
    constructor(private readonly pipelineService: PipelineService) { }

    @Post('channel')
    async processChannel(@Body() body: ProcessChannelDto) {
        return await this.pipelineService.processChannel(body.channel, body.limit);
    }
}
