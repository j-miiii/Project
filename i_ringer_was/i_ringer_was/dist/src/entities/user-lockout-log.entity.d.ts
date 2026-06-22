import { User } from './user.entity';
export declare class UserLockoutLog {
    id: number;
    user_id: number;
    event_type: string;
    changed_at: Date;
    changed_by: string;
    created_at: Date;
    updated_at: Date;
    user: User;
}
