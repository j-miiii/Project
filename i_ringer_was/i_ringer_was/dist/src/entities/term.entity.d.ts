import { UserTermAgreement } from './user-term-agreement.entity';
export declare class Term {
    id: number;
    title: string;
    content: string;
    version: string;
    type: string;
    is_required: boolean;
    is_active: boolean;
    effective_at: Date;
    created_at: Date;
    updated_at: Date;
    agreements: UserTermAgreement[];
}
