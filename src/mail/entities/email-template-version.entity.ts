import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EmailTemplateVersionStatus = 'draft' | 'published' | 'archived';

@Entity('email_template_version')
@Index(['templateId', 'versionNumber'], { unique: true })
@Index('UQ_email_template_version_draft', ['templateId'], {
  unique: true,
  where: `"status" = 'draft'`,
})
@Index('UQ_email_template_version_published', ['templateId'], {
  unique: true,
  where: `"status" = 'published'`,
})
export class EmailTemplateVersion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) templateId: string;

  // Assigned only on publish, so draft rows don't consume a slot and history
  // stays a gapless, append-only sequence.
  @Column({ type: 'int', nullable: true }) versionNumber: number | null;

  @Column({ default: 'draft' }) status: EmailTemplateVersionStatus;

  @Column({ type: 'varchar', length: 500 }) subject: string;

  @Column({ type: 'text' }) bodyHtml: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  sampleData: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;

  @CreateDateColumn() createdAt: Date;
}
