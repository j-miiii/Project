export declare class CreateRoomDto {
    ward_id: number;
    name: string;
    bed_count: number;
}
declare const UpdateRoomDto_base: import("@nestjs/common").Type<Partial<CreateRoomDto>>;
export declare class UpdateRoomDto extends UpdateRoomDto_base {
}
export {};
