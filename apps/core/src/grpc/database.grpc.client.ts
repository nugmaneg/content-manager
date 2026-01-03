import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Observable, firstValueFrom } from 'rxjs';

// User interfaces - fields must match proto definition (snake_case)
interface UserResponse {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    is_active: boolean;
    role: string;
    telegram_id: string;
    telegram_username: string;
    avatar_url: string;
    refresh_token_hash: string;
    created_at: string;
    updated_at: string;
}

interface GetUserByIdRequest {
    id: string;
}

interface GetUserByEmailRequest {
    email: string;
}

interface CreateUserRequest {
    email: string;
    name?: string;
    password_hash: string;
    role?: string;
}

interface UpdateUserRefreshTokenRequest {
    id: string;
    refresh_token_hash: string;
}

interface CountUsersResponse {
    count: number;
}

interface DatabaseService {
    getUserById(data: GetUserByIdRequest): Observable<UserResponse>;
    getUserByEmail(data: GetUserByEmailRequest): Observable<UserResponse>;
    createUser(data: CreateUserRequest): Observable<UserResponse>;
    updateUserRefreshToken(data: UpdateUserRefreshTokenRequest): Observable<UserResponse>;
    countUsers(data: Record<string, never>): Observable<CountUsersResponse>;
}

@Injectable()
export class DatabaseGrpcClient implements OnModuleInit {
    private readonly logger = new Logger(DatabaseGrpcClient.name);
    private databaseService: DatabaseService;
    private client: ClientGrpc;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const grpcUrl = this.configService.get<string>('DATABASE_GRPC_URL') || 'localhost:50051';

        // Create gRPC client dynamically
        const { ClientProxyFactory } = require('@nestjs/microservices');

        // Proto path works in both local dev and Docker
        // In Docker: /app/libs/grpc-contracts/database.proto
        // In local: /path/to/project/libs/grpc-contracts/database.proto
        const protoPath = join(process.cwd(), 'libs/grpc-contracts/database.proto');

        this.client = ClientProxyFactory.create({
            transport: Transport.GRPC,
            options: {
                package: 'database',
                protoPath,
                url: grpcUrl,
                loader: {
                    keepCase: true,   // Keep snake_case from proto
                    defaults: true,    // Include default values (false, 0, "")
                    arrays: true,      // Always return arrays
                    objects: true,     // Always return objects
                },
            },
        }) as ClientGrpc;

        this.databaseService = this.client.getService<DatabaseService>('DatabaseService');
        this.logger.log(`Connected to database gRPC service at ${grpcUrl}`);
    }

    async getUserById(id: string): Promise<UserResponse | null> {
        try {
            return await firstValueFrom(this.databaseService.getUserById({ id }));
        } catch (error: any) {
            if (error.code === 5) { // NOT_FOUND
                return null;
            }
            throw error;
        }
    }

    async getUserByEmail(email: string): Promise<UserResponse | null> {
        try {
            return await firstValueFrom(this.databaseService.getUserByEmail({ email }));
        } catch (error: any) {
            if (error.code === 5) { // NOT_FOUND
                return null;
            }
            throw error;
        }
    }

    async createUser(data: CreateUserRequest): Promise<UserResponse> {
        return await firstValueFrom(this.databaseService.createUser(data));
    }

    async updateUserRefreshToken(id: string, refreshTokenHash: string): Promise<UserResponse> {
        return await firstValueFrom(
            this.databaseService.updateUserRefreshToken({
                id,
                refresh_token_hash: refreshTokenHash,
            })
        );
    }

    async countUsers(): Promise<number> {
        const result = await firstValueFrom(this.databaseService.countUsers({}));
        return result.count;
    }
}
