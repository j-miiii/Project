import { Ward } from './ward.entity';
import { Bed } from './bed.entity';
import { NurseRoomAssignment } from './nurse-room-assignment.entity';
export declare class Room {
    id: number;
    ward_id: number;
    name: string;
    code: string;
    type: string;
    bed_count: number;
    created_at: Date;
    updated_at: Date;
    ward: Ward;
    beds: Bed[];
    nurseRoomAssignments: NurseRoomAssignment[];
}
