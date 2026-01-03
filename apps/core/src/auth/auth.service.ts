import { Injectable, UnauthorizedException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload, AuthResponse, TokensResponse } from './interfaces';
import { DatabaseGrpcClient } from '../grpc';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly accessTokenTtl: number;
    private readonly refreshTokenTtl: number;
    private readonly allowRegistration: boolean;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly dbClient: DatabaseGrpcClient,
    ) {
        this.accessTokenTtl = 15 * 60; // 15 minutes in seconds
        this.refreshTokenTtl = 7 * 24 * 60 * 60; // 7 days in seconds
        this.allowRegistration = this.configService.get<string>('ALLOW_REGISTRATION') === 'true';
    }

    async register(dto: RegisterDto): Promise<AuthResponse> {
        // Check if registration is allowed
        if (!this.allowRegistration) {
            throw new ForbiddenException('Registration is currently disabled');
        }

        // Check if user already exists
        const existingUser = await this.dbClient.getUserByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, 10);

        // Determine role - first user becomes FATHER
        const userCount = await this.dbClient.countUsers();
        const role = userCount === 0 ? 'FATHER' : 'USER';

        this.logger.log(`Registering user ${dto.email} with role ${role} (total users: ${userCount})`);

        // Create user
        const user = await this.dbClient.createUser({
            email: dto.email,
            name: dto.name,
            password_hash: passwordHash,
            role,
        });

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email, user.role);

        // Save refresh token hash
        const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
        await this.dbClient.updateUserRefreshToken(user.id, refreshTokenHash);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        // Find user
        const user = await this.dbClient.getUserByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check if user is active
        if (!user.is_active) {
            throw new UnauthorizedException('Account is deactivated');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email, user.role);

        // Save refresh token hash
        const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
        await this.dbClient.updateUserRefreshToken(user.id, refreshTokenHash);

        this.logger.log(`User ${user.email} logged in successfully`);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    async refresh(refreshToken: string): Promise<TokensResponse> {
        try {
            // Verify refresh token
            const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-change-me',
            });

            // Get user
            const user = await this.dbClient.getUserById(payload.sub);
            if (!user || !user.is_active) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Verify stored refresh token hash
            if (!user.refresh_token_hash) {
                throw new UnauthorizedException('Refresh token has been revoked');
            }

            const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refresh_token_hash);
            if (!isValidRefreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user.id, user.email, user.role);

            // Update refresh token hash
            const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
            await this.dbClient.updateUserRefreshToken(user.id, newRefreshTokenHash);

            return tokens;
        } catch (error) {
            this.logger.error('Refresh token error:', error);
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(userId: string): Promise<void> {
        // Clear refresh token hash
        await this.dbClient.updateUserRefreshToken(userId, '');
        this.logger.log(`User ${userId} logged out`);
    }

    async getMe(userId: string) {
        const user = await this.dbClient.getUserById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            telegramId: user.telegram_id || null,
            telegramUsername: user.telegram_username || null,
            avatarUrl: user.avatar_url || null,
            createdAt: user.created_at,
        };
    }

    private async generateTokens(userId: string, email: string, role: string): Promise<TokensResponse> {
        const payload: JwtPayload = {
            sub: userId,
            email,
            role,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_SECRET') || 'default-secret-change-me',
                expiresIn: this.accessTokenTtl,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-change-me',
                expiresIn: this.refreshTokenTtl,
            }),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.accessTokenTtl,
        };
    }
}
