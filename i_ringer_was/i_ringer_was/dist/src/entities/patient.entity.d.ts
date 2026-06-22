import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { PatientVital } from './patient-vital.entity';
import { DrugOrder } from './drug-order.entity';
export declare class Patient {
    id: number;
    name: string;
    chart_number: string;
    sex: string;
    age: number;
    dob: string;
    dept: string;
    doc: string;
    resident: string;
    pa_nurse: string;
    adm: string;
    created_at: Date;
    udpated_at: Date;
    bedAssignments: PatientBedAssignment[];
    vitals: PatientVital[];
    drugOrders: DrugOrder[];
}
