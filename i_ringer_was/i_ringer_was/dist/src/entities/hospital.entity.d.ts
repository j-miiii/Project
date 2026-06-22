import { Ward } from './ward.entity';
export declare class Hospital {
    id: number;
    name: string;
    created_at: Date;
    udpated_at: Date;
    wards: Ward[];
}
