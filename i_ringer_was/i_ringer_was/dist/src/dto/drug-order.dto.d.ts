export declare enum DrugOrderStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    CANCELED = "canceled"
}
export declare class CreateDrugOrderDto {
    patient_id: number;
    infusion_id: number;
    order_code?: string;
    volume?: number;
    gtt?: number;
    cchr?: number;
    order_date?: string;
    status?: DrugOrderStatus;
}
declare const UpdateDrugOrderDto_base: import("@nestjs/common").Type<Partial<CreateDrugOrderDto>>;
export declare class UpdateDrugOrderDto extends UpdateDrugOrderDto_base {
}
export {};
