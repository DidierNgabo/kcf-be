import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Child } from '../../children/entities/child.entity';

@Entity()
export class Sponsor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  message: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  followUpSentAt: Date;

  @Column({ default: false })
  unsubscribed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  unsubscribedAt: Date | null;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  unsubscribeToken: string;

  @Column({ type: 'text', nullable: true })
  childInterests: string | null;

  @Column({ type: 'text', nullable: true })
  schoolGoals: string | null;

  @Column({ type: 'text', nullable: true })
  hobbiesAndTalents: string | null;

  @Column({ type: 'text', nullable: true })
  communicationPreferences: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  preferencesCompletedAt: Date | null;

  @ManyToOne(() => Child, (child) => child.sponsors, { nullable: true, eager: true, onDelete: 'SET NULL' })
  child: Child;
}
