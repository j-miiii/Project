import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { Device } from './device.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number;

  @Column({ nullable: true })
  patient_bed_assignment_id: number;

  @Column({ nullable: true })
  device_id: number;

  @Column({ length: 200, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'enum', enum: ['slow', 'fast', 'almost_done', 'stop', 'done', 'disconnected'], nullable: true })
  type: string;

  @Column({ type: 'tinyint', nullable: true })
  is_read: number;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.notifications)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PatientBedAssignment, assignment => assignment.notifications)
  @JoinColumn({ name: 'patient_bed_assignment_id' })
  patientBedAssignment: PatientBedAssignment;

  @Column({ type: 'enum', enum: ['critical', 'caution', 'system_error'], nullable: true, comment: '알림 카테고리' })
  alert_category: string;

  @ManyToOne(() => Device, device => device.notifications)
  @JoinColumn({ name: 'device_id' })
  device: Device;
}