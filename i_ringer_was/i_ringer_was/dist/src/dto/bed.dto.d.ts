export declare enum BedStatus {
    AVAILABLE = "available",
    OCCUPIED = "occupied",
    MAINTENANCE = "maintenance"
}
export declare class CreateBedDto {
    room_id: number;
    bed_number: string;
    status: BedStatus;
}
declare const UpdateBedDto_base: import("@nestjs/common").Type<Partial<CreateBedDto>>;
export declare class UpdateBedDto extends UpdateBedDto_base {
}
export {};
