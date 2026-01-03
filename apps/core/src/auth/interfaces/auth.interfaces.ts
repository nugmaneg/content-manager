export interface JwtPayload {
    sub: string; // user id
    email: string;
    role: string;
}

export interface TokensResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface AuthResponse extends TokensResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
}

export interface UserFromToken {
    id: string;
    email: string;
    role: string;
}
