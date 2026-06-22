import { User } from './user.entity';
import { Term } from './term.entity';
export declare class UserTermAgreement {
    id: number;
    user_id: number;
    term_id: number;
    agreed_at: Date;
    created_at: Date;
    updated_at: Date;
    user: User;
    term: Term;
}
