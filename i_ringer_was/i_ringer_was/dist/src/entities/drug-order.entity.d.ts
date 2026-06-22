import { Patient } from './patient.entity';
import { Infusion } from './infusion.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
export declare class DrugOrder {
    id: number;
    patient_id: number;
    infusion_id: number;
    order_code: string;
    volume: number;
    gtt: number;
    cchr: number;
    order_date: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    patient: Patient;
    infusion: Infusion;
    bedAssignments: PatientBedAssignment[];
}
