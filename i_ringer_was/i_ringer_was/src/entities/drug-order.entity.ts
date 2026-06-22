import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { Infusion } from './infusion.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';

@Entity('drug_orders')
export class DrugOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  patient_id: number;

  @Column({ nullable: true, comment: '수액 종류 ID (infusions FK)' })
  infusion_id: number;

  @Column({ length: 50, nullable: true, comment: '처방 코드' })
  order_code: string;

  @Column({ type: 'int', nullable: true, comment: '처방 용량 (ml)' })
  volume: number;

  @Column({ type: 'int', nullable: true, comment: '처방 유속 (gtt/min)' })
  gtt: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '처방 유속 (ml/hr)' })
  cchr: number;

  @Column({ length: 10, nullable: true, comment: '처방 일자 (YYYYMMDD)' })
  order_date: string;

  @Column({ type: 'enum', enum: ['active', 'completed', 'canceled'], default: 'active', comment: '처방 상태' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Patient, patient => patient.drugOrders)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Infusion, infusion => infusion.drugOrders)
  @JoinColumn({ name: 'infusion_id' })
  infusion: Infusion;

  @OneToMany(() => PatientBedAssignment, assignment => assignment.drugOrder)
  bedAssignments: PatientBedAssignment[];
}
