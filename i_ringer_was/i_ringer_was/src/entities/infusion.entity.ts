import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DrugOrder } from './drug-order.entity';
import { PatientBedAssignment } from './patient-bed-assignment.entity';

@Entity('infusions')
export class Infusion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, nullable: true, comment: '영문 약어 (NS, DW, HD 등)' })
  code: string;

  @Column({ length: 100, comment: '수액명' })
  name: string;

  @Column({ type: 'int', nullable: true, comment: '기본 용량 (ml)' })
  default_volume: number;

  @Column({ type: 'int', nullable: true, comment: '기본 유속 (gtt/min)' })
  default_gtt: number;

  @Column({ type: 'int', nullable: true, comment: '기본 유속 (cc/hr)' })
  default_cchr: number;

  @Column({ length: 500, nullable: true, comment: '설명' })
  description: string;

  @Column({ type: 'boolean', default: true, comment: '활성 여부' })
  is_active: boolean;

  @Column({ type: 'int', default: 0, comment: '표시순서' })
  display_order: number;

  @Column({ type: 'int', default: 0, comment: '사용횟수' })
  usage_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => DrugOrder, order => order.infusion)
  drugOrders: DrugOrder[];

  @OneToMany(() => PatientBedAssignment, assignment => assignment.infusion)
  bedAssignments: PatientBedAssignment[];
}
