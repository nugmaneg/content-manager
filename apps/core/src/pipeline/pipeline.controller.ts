import { Controller } from '@nestjs/common';
import { PipelineService } from './pipeline.service';

// export class ProcessChannelDto {
//     channel: string;
//     limit?: number;
// }

@Controller('pipeline')
export class PipelineController {
    constructor(private readonly pipelineService: PipelineService) { }

    // Deprecated: PipelineService.processChannel() больше не существует
    // Используйте /api/sources/:id/sync вместо этого

    // @Post('channel')
    // async processChannel(@Body() body: ProcessChannelDto) {
    //     return await this.pipelineService.processContent(...);
    // }
}
