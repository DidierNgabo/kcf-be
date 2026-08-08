import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EmailTemplateKind = 'trigger' | 'broadcast';

@Entity('email_template')
@Index(
  'UQ_email_template_trigger_locale_channel',
  ['triggerKey', 'locale', 'channel'],
  {
    unique: true,
    where: `"kind" = 'trigger'`,
  },
)
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() triggerKey: string;

  @Column({ default: 'default' }) locale: string;

  @Column({ default: 'email' }) channel: string;

  @Column({ default: 'trigger' }) kind: EmailTemplateKind;

  // Staff-given label — only set (and shown) for broadcasts; trigger-backed
  // templates use the registry's trigger name instead.
  @Column({ type: 'varchar', nullable: true }) name: string | null;

  @Column({ type: 'uuid', nullable: true }) layoutId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
