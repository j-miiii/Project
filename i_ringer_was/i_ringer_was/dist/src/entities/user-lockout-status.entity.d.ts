import { User } from './user.entity';
export declare class UserLockoutStatus {
    id: number;
    user_id: number;
    failure_count: number;
    is_locked: boolean;
    created_at: Date;
    updated_at: Date;
    user: User;
}
