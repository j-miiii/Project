export declare enum NotificationType {
    SLOW = "slow",
    FAST = "fast",
    ALMOST_DONE = "almost_done",
    STOP = "stop",
    DONE = "done",
    DISCONNECTED = "disconnected"
}
export declare enum NotificationAlertCategory {
    CRITICAL = "critical",
    CAUTION = "caution",
    SYSTEM_ERROR = "system_error"
}
export declare class CreateNotificationDto {
    user_id: number;
    patient_bed_assignment_id?: number;
    device_id?: number;
    title: string;
    message: string;
    type: NotificationType;
    is_read?: boolean;
    alert_category?: NotificationAlertCategory;
}
declare const UpdateNotificationDto_base: import("@nestjs/common").Type<Partial<CreateNotificationDto>>;
export declare class UpdateNotificationDto extends UpdateNotificationDto_base {
}
export {};
