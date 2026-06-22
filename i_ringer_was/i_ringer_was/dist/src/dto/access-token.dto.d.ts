export declare class CreateAccessTokenDto {
    user_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: string;
}
declare const UpdateAccessTokenDto_base: import("@nestjs/common").Type<Partial<CreateAccessTokenDto>>;
export declare class UpdateAccessTokenDto extends UpdateAccessTokenDto_base {
}
export {};
