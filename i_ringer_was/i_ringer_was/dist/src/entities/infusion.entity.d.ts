import { DrugOrder } from './drug-order.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
export declare class Infusion {
    id: number;
    code: string;
    name: string;
    default_volume: number;
    default_gtt: number;
    default_cchr: number;
    description: string;
    is_active: boolean;
    display_order: number;
    usage_count: number;
    created_at: Date;
    updated_at: Date;
    drugOrders: DrugOrder[];
    bedAssignments: PatientBedAssignment[];
}
