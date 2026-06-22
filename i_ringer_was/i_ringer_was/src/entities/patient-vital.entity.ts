import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('patient_vitals')
export class PatientVital {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  patient_id: number;

  @Column({ length: 50, nullable: true, comment: 'visit 고유번호' })
  adm: string;

  @Column({ length: 10, nullable: true, comment: '기록일자 (YYYYMMDD)' })
  date: string;

  @Column({ length: 10, nullable: true, comment: '기록시간 (HHmm)' })
  time: string;

  @Column({ length: 50, nullable: true, comment: '입력자 EMR key' })
  nurse_key: string;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true, comment: '신장 (cm)' })
  height: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true, comment: '체중 (kg)' })
  weight: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Patient, patient => patient.vitals)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;
}
