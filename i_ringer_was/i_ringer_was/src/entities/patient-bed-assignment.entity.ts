import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { Bed } from './bed.entity';
import { Device } from './device.entity';
import { DrugOrder } from './drug-order.entity';
import { Infusion } from './infusion.entity';
import { Notification } from './notification.entity';
import { InfusionEventLog } from './infusion-event-log.entity';

@Entity('patient_bed_assignments')
export class PatientBedAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  patient_id: number;

  @Column({ nullable: true })
  bed_id: number;

  @Column({ nullable: true })
  device_id: number;

  @Column({ nullable: true })
  drug_order_id: number;

  @Column({ type: 'int', nullable: true, comment: '수액 ID' })
  infusion_id: number;

  @Column({ length: 100, nullable: true })
  infusion_type: string;

  @Column({ length: 20, nullable: true, comment: '수액 영문 약어 (NS, DW, HD, KCL 등)' })
  infusion_code: string;

  @Column({ nullable: true })
  infusion_total_volume: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, default: 0, comment: '처방 GTT (방울/분)' })
  infusion_gtt: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '처방 CCHR (ml/hr)' })
  infusion_cchr: number;

  @Column({ type: 'int', nullable: true, comment: '현재 투여량 (ml)' })
  infusion_current_volume: number;

  @Column({ type: 'int', default: 0, comment: '이전 투여량 (ml)' })
  last_current_volume: number;

  @Column({ type: 'enum', enum: ['stop', 'done', 'fast', 'slow', 'almost_done', 'disconnected'], nullable: true, comment: '알림 타입' })
  alert_type: string;

  @Column({ type: 'datetime', nullable: true })
  assigned_at: Date;

  @Column({ type: 'datetime', nullable: true })
  released_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '마지막 측정 무게(g) - LOAD_CELL용' })
  last_measured_weight: number;

  @Column({ type: 'bigint', nullable: true, comment: '마지막 측정 시간(마이크로초) - LOAD_CELL용' })
  last_measured_time: number;

  @Column({ type: 'datetime', nullable: true, comment: '첫 번째 gtt=0 감지 시간' })
  first_zero_gtt_at: Date;

  @Column({ type: 'datetime', nullable: true, comment: '첫 번째 cchr=0 감지 시간' })
  first_zero_cchr_at: Date;

  @Column({ type: 'enum', enum: ['pending', 'infusing', 'paused', 'completed', 'canceled'], default: 'pending', comment: '투여 상태' })
  status: string;

  @Column({ type: 'boolean', default: true, comment: '활성 여부' })
  is_active: boolean;

  @Column({ type: 'datetime', nullable: true, comment: '투여 시작 시간' })
  started_at: Date;

  @Column({ type: 'datetime', nullable: true, comment: '투여 중지 시간' })
  stopped_at: Date;

  @Column({ type: 'enum', enum: ['critical', 'caution', 'system_error'], nullable: true, comment: '알림 카테고리' })
  alert_category: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Patient, patient => patient.bedAssignments)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Bed, bed => bed.bedAssignments)
  @JoinColumn({ name: 'bed_id' })
  bed: Bed;

  @ManyToOne(() => Device, device => device.bedAssignments, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => DrugOrder, drugOrder => drugOrder.bedAssignments)
  @JoinColumn({ name: 'drug_order_id' })
  drugOrder: DrugOrder;

  @ManyToOne(() => Infusion, infusion => infusion.bedAssignments)
  @JoinColumn({ name: 'infusion_id' })
  infusion: Infusion;

  @OneToMany(() => Notification, notification => notification.patientBedAssignment)
  notifications: Notification[];

  @OneToMany(() => InfusionEventLog, log => log.patientBedAssignment)
  infusionEventLogs: InfusionEventLog[];
}