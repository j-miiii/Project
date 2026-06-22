import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { User } from './user.entity';

@Entity('infusion_event_logs')
export class InfusionEventLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  patient_bed_assignment_id: number;

  @Column({ type: 'enum', enum: ['start', 'pause', 'resume', 'complete', 'cancel', 'alert', 'modify'], nullable: false, comment: '이벤트 유형' })
  event_type: string;

  @Column({ type: 'json', nullable: true, comment: '변경 전 값' })
  before_value: any;

  @Column({ type: 'json', nullable: true, comment: '변경 후 값' })
  after_value: any;

  @Column({ nullable: true, comment: '수행자 (간호사 user_id)' })
  performed_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => PatientBedAssignment, assignment => assignment.infusionEventLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_bed_assignment_id' })
  patientBedAssignment: PatientBedAssignment;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performed_by' })
  performer: User;
}
