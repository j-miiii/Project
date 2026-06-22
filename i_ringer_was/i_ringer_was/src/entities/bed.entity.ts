import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Room } from './room.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Device } from './device.entity';

@Entity('beds')
export class Bed {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  room_id: number;

  @Column({ length: 50, nullable: true })
  bed_number: string;

  @Column({ type: 'enum', enum: ['available', 'occupied', 'maintenance'], default: 'available', nullable: true })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Room, room => room.beds)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => Device, device => device.bed)
  devices: Device[];

  @OneToMany(() => PatientBedAssignment, assignment => assignment.bed)
  bedAssignments: PatientBedAssignment[];
}