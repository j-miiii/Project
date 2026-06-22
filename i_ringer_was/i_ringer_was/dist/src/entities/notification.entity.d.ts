import { User } from './user.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Device } from './device.entity';
export declare class Notification {
    id: number;
    user_id: number;
    patient_bed_assignment_id: number;
    device_id: number;
    title: string;
    message: string;
    type: string;
    is_read: number;
    read_at: Date;
    created_at: Date;
    updated_at: Date;
    user: User;
    patientBedAssignment: PatientBedAssignment;
    alert_category: string;
    device: Device;
}
