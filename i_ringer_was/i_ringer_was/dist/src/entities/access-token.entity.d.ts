import { User } from './user.entity';
export declare class AccessToken {
    id: number;
    user_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
    user: User;
}
