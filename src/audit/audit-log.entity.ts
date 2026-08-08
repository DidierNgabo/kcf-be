import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() action: string;
  @Column() entityType: string;
  @Column({ type: 'uuid' }) entityId: string;
  @Column({ type: 'uuid', nullable: true }) actorUserId: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'" }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
}
