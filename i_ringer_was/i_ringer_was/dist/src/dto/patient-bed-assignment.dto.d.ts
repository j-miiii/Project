export declare enum AssignmentStatus {
    PENDING = "pending",
    INFUSING = "infusing",
    PAUSED = "paused",
    COMPLETED = "completed",
    CANCELED = "canceled"
}
export declare enum AlertType {
    STOP = "stop",
    DONE = "done",
    FAST = "fast",
    SLOW = "slow",
    ALMOST_DONE = "almost_done",
    DISCONNECTED = "disconnected"
}
export declare enum AlertCategory {
    CRITICAL = "critical",
    CAUTION = "caution",
    SYSTEM_ERROR = "system_error"
}
export declare class BulkReleaseDto {
    ids: number[];
}
export declare class CreatePatientBedAssignmentDto {
    patient_id: number;
    bed_id: number;
    device_id?: number;
    infusion_type?: string;
    infusion_total_volumn?: number;
    infusion_gtt?: number;
    infusion_cchr?: number;
    assigned_at?: string;
    discharged_at?: string;
    status?: AssignmentStatus;
    is_active?: boolean;
    started_at?: string;
    stopped_at?: string;
    alert_category?: AlertCategory;
}
declare const UpdatePatientBedAssignmentDto_base: import("@nestjs/common").Type<Partial<CreatePatientBedAssignmentDto>>;
export declare class UpdatePatientBedAssignmentDto extends UpdatePatientBedAssignmentDto_base {
}
export {};
