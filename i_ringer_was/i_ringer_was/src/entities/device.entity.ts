import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Notification } from './notification.entity';
import { Bed } from './bed.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: true })
  device_name: string;

  @Column({ length: 100, nullable: true })
  serial_number: string;

  @Column({ type: 'enum', enum: ['online', 'offline', 'unknown'], default: 'unknown', nullable: true })
  network_status: string;

  @Column({ nullable: true })
  battery_percent: number;

  @Column({ type: 'datetime', nullable: true })
  last_udpate_at: Date;

  @Column({ length: 50, nullable: true })
  firmware_version: string;

  @Column({ nullable: true })
  bed_id: number;

  @Column({ type: 'int', nullable: true })
  ward_id: number;

  @Column({ type: 'int', nullable: true })
  room_id: number;

  @Column({ type: 'int', nullable: true })
  hospital_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Bed, bed => bed.devices)
  @JoinColumn({ name: 'bed_id' })
  bed: Bed;

  @OneToMany(() => PatientBedAssignment, assignment => assignment.device)
  bedAssignments: PatientBedAssignment[];

  @OneToMany(() => Notification, notification => notification.device)
  notifications: Notification[];
}