import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Term } from './term.entity';

@Entity('user_term_agreements')
export class UserTermAgreement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  term_id: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '동의 시간' })
  agreed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.termAgreements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Term, term => term.agreements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id' })
  term: Term;
}
