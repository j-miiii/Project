export declare enum NetworkStatus {
    ONLINE = "online",
    OFFLINE = "offline",
    ERROR = "error"
}
export declare class CreateDeviceDto {
    device_name: string;
    serial_number: string;
    network_status: NetworkStatus;
    battery_percent?: number;
    firmware_version?: string;
    bed_id?: string;
    ward_id?: number;
    room_id?: number;
    hospital_id?: number;
}
declare const UpdateDeviceDto_base: import("@nestjs/common").Type<Partial<CreateDeviceDto>>;
export declare class UpdateDeviceDto extends UpdateDeviceDto_base {
}
export {};
