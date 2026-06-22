import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Ward } from './ward.entity';
import { Bed } from './bed.entity';
import { NurseRoomAssignment } from './nurse-room-assignment.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  ward_id: number;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ length: 20, nullable: true, comment: 'EMR 병실코드' })
  code: string;

  @Column({ length: 50, nullable: true, comment: '병실유형 (예: 4인용병실)' })
  type: string;

  @Column({ nullable: true })
  bed_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Ward, ward => ward.rooms)
  @JoinColumn({ name: 'ward_id' })
  ward: Ward;

  @OneToMany(() => Bed, bed => bed.room)
  beds: Bed[];

  @OneToMany(() => NurseRoomAssignment, assignment => assignment.room)
  nurseRoomAssignments: NurseRoomAssignment[];
}