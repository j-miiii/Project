import { Hospital } from './hospital.entity';
import { Room } from './room.entity';
export declare class Ward {
    id: number;
    hospital_id: number;
    name: string;
    code: string;
    created_at: Date;
    udpated_at: Date;
    hospital: Hospital;
    rooms: Room[];
}
