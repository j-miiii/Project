import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Room } from './room.entity';

@Entity('nurse_room_assignments')
export class NurseRoomAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  room_id: number;

  @Column({ type: 'boolean', default: true, comment: '활성 여부' })
  is_active: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '배정 시간' })
  assigned_at: Date;

  @Column({ type: 'datetime', nullable: true, comment: '해제 시간' })
  released_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.nurseRoomAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room, room => room.nurseRoomAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
