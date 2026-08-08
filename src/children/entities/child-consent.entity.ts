import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Child } from './child.entity';
import { ConsentStatus, ConsentType } from '../enums/child.enums';

@Entity('child_consent')
export class ChildConsent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Child, (child) => child.consents, { onDelete: 'CASCADE' }) child: Child;
  @Column({ type: 'varchar' }) type: ConsentType;
  @Column({ type: 'varchar', default: ConsentStatus.PENDING }) status: ConsentStatus;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) effectiveAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @Column({ type: 'uuid', nullable: true }) recordedByUserId: string | null;
  @CreateDateColumn() createdAt: Date;
}
