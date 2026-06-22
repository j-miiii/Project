import { Room } from './room.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Device } from './device.entity';
export declare class Bed {
    id: number;
    room_id: number;
    bed_number: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    room: Room;
    devices: Device[];
    bedAssignments: PatientBedAssignment[];
}
