import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserTermAgreement } from './user-term-agreement.entity';

@Entity('terms')
export class Term {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200, nullable: false, comment: '약관 제목' })
  title: string;

  @Column({ type: 'text', nullable: false, comment: '약관 내용' })
  content: string;

  @Column({ length: 20, nullable: false, comment: '약관 버전' })
  version: string;

  @Column({ type: 'enum', enum: ['privacy', 'service', 'marketing', 'location'], nullable: false, comment: '약관 유형' })
  type: string;

  @Column({ type: 'boolean', default: true, comment: '필수 동의 여부' })
  is_required: boolean;

  @Column({ type: 'boolean', default: true, comment: '활성 여부' })
  is_active: boolean;

  @Column({ type: 'datetime', nullable: true, comment: '시행일' })
  effective_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserTermAgreement, agreement => agreement.term)
  agreements: UserTermAgreement[];
}
