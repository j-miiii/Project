import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { User } from './user.entity';
export declare class InfusionEventLog {
    id: number;
    patient_bed_assignment_id: number;
    event_type: string;
    before_value: any;
    after_value: any;
    performed_by: number;
    created_at: Date;
    updated_at: Date;
    patientBedAssignment: PatientBedAssignment;
    performer: User;
}
