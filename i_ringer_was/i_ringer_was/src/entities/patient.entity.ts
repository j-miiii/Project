import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PatientBedAssignment } from './patient-bed-assignment.entity';
import { PatientVital } from './patient-vital.entity';
import { DrugOrder } from './drug-order.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ length: 50, nullable: true })
  chart_number: string;

  @Column({ length: 1, nullable: true, comment: '성별 (M/F)' })
  sex: string;

  @Column({ type: 'int', nullable: true, comment: '나이' })
  age: number;

  @Column({ length: 10, nullable: true, comment: '생년월일 (YYMMDD)' })
  dob: string;

  @Column({ length: 20, nullable: true, comment: '진료과 코드' })
  dept: string;

  @Column({ length: 50, nullable: true, comment: '진료의' })
  doc: string;

  @Column({ length: 50, nullable: true, comment: '주치의' })
  resident: string;

  @Column({ length: 50, nullable: true, comment: '담당간호사' })
  pa_nurse: string;

  @Column({ length: 50, nullable: true, comment: '환자 visit별 고유번호' })
  adm: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  udpated_at: Date;

  @OneToMany(() => PatientBedAssignment, assignment => assignment.patient)
  bedAssignments: PatientBedAssignment[];

  @OneToMany(() => PatientVital, vital => vital.patient)
  vitals: PatientVital[];

  @OneToMany(() => DrugOrder, order => order.patient)
  drugOrders: DrugOrder[];
}