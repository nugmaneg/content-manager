import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { existsSync } from 'fs';
import { DatabaseModule } from './database.module';
import { WinstonModule } from 'nest-winston';
import { getLoggerConfig, AllExceptionsFilter } from '@logger';

// Определяем путь к proto файлу (разный для dev и prod)
function getProtoPath(): string {
    // Для Docker/production (запуск из dist/)
    const prodPath = join(__dirname, '../../../libs/grpc-contracts/database.proto');
    if (existsSync(prodPath)) {
        return prodPath;
    }

    // Для локальной разработки (запуск из корня проекта)
    const devPath = join(process.cwd(), 'libs/grpc-contracts/database.proto');
    if (existsSync(devPath)) {
        return devPath;
    }

    throw new Error(`Proto file not found. Tried: ${prodPath}, ${devPath}`);
}

async function bootstrap() {
    // HTTP сервер (для health checks и REST API)
    const app = await NestFactory.create(DatabaseModule, {
        logger: WinstonModule.createLogger(getLoggerConfig('database')),
    });

    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

    // gRPC микросервис
    const grpcPort = process.env.DATABASE_GRPC_PORT || 50051;
    const protoPath = getProtoPath();

    console.log(`📄 Loading proto file from: ${protoPath}`);

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: 'database',
            protoPath,
            url: `0.0.0.0:${grpcPort}`,
            loader: {
                keepCase: true,   // Keep snake_case from proto
                defaults: true,    // Include default values (false, 0, "")
                arrays: true,      // Always return arrays
                objects: true,     // Always return objects
            },
        },
    });

    // Graceful shutdown
    app.enableShutdownHooks();

    // Запускаем оба транспорта
    await app.startAllMicroservices();
    console.log(`📡 gRPC server is running on port ${grpcPort}`);

    // HTTP порт
    const httpPort = process.env.DATABASE_SERVICE_PORT || process.env.PORT || 3003;
    await app.listen(httpPort);
    console.log(`🗄️  Database HTTP service is running on port ${httpPort}`);
}
bootstrap();
