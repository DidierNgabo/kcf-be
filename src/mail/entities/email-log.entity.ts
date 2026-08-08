import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EmailLogStatus = 'queued' | 'sent' | 'failed';

@Entity('email_log')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column()
  triggerKey: string;

  // Nullable: a code-default fallback send has no DB template/version row.
  @Column({ type: 'uuid', nullable: true }) templateId: string | null;
  @Column({ type: 'uuid', nullable: true }) versionId: string | null;

  @Column({ default: 'default' }) locale: string;

  @Column() recipientEmail: string;

  @Column({ type: 'varchar', nullable: true }) subjectRendered: string | null;

  // The input `data` passed to send(), with sensitive trigger fields redacted.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Index()
  @Column({ default: 'queued' })
  status: EmailLogStatus;

  @Column({ type: 'int', default: 0 }) attemptCount: number;

  @Column({ type: 'text', nullable: true }) errorMessage: string | null;

  @Column({ type: 'varchar', nullable: true }) providerMessageId: string | null;

  @Column({ default: false }) isTest: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' }) queuedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
