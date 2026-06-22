import { Patient } from './patient.entity';
export declare class PatientVital {
    id: number;
    patient_id: number;
    adm: string;
    date: string;
    time: string;
    nurse_key: string;
    height: number;
    weight: number;
    created_at: Date;
    updated_at: Date;
    patient: Patient;
}
