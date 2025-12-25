import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('Exceptions');

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        // In certain situations `httpAdapter` might not be available in the
        // constructor method, thus we should resolve it here.
        const { httpAdapter } = this.httpAdapterHost;

        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : { message: (exception as any)?.message || 'Internal server error', statusCode: httpStatus };

        const responseBody =
            typeof exceptionResponse === 'object'
                ? { ...exceptionResponse, timestamp: new Date().toISOString(), path: httpAdapter.getRequestUrl(request) }
                : {
                    statusCode: httpStatus,
                    message: exceptionResponse,
                    timestamp: new Date().toISOString(),
                    path: httpAdapter.getRequestUrl(request),
                };

        this.logger.error(
            `Unhandled Exception: ${JSON.stringify({
                status: httpStatus,
                path: httpAdapter.getRequestUrl(request),
                method: request.method,
                response: exceptionResponse,
                stack: (exception as Error)?.stack,
            })}`,
        );

        httpAdapter.reply(response, responseBody, httpStatus);
    }
}
