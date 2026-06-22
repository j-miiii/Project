import { User } from './user.entity';
import { Room } from './room.entity';
export declare class NurseRoomAssignment {
    id: number;
    user_id: number;
    room_id: number;
    is_active: boolean;
    assigned_at: Date;
    released_at: Date;
    created_at: Date;
    updated_at: Date;
    user: User;
    room: Room;
}
