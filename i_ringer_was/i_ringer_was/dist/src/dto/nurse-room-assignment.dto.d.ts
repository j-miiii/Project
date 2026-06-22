export declare class CreateNurseRoomAssignmentDto {
    user_id: number;
    room_id: number;
    is_active?: boolean;
    assigned_at?: string;
    released_at?: string;
}
declare const UpdateNurseRoomAssignmentDto_base: import("@nestjs/common").Type<Partial<CreateNurseRoomAssignmentDto>>;
export declare class UpdateNurseRoomAssignmentDto extends UpdateNurseRoomAssignmentDto_base {
}
export {};
