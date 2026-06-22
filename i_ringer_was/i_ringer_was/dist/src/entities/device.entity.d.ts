import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Notification } from './notification.entity';
import { Bed } from './bed.entity';
export declare class Device {
    id: number;
    device_name: string;
    serial_number: string;
    network_status: string;
    battery_percent: number;
    last_udpate_at: Date;
    firmware_version: string;
    bed_id: number;
    ward_id: number;
    room_id: number;
    hospital_id: number;
    created_at: Date;
    updated_at: Date;
    bed: Bed;
    bedAssignments: PatientBedAssignment[];
    notifications: Notification[];
}
