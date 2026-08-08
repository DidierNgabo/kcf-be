import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ImportAction } from '../enums/child.enums';
import { ChildImport } from './child-import.entity';

@Entity('child_import_row')
@Unique(['importBatch', 'rowNumber'])
export class ChildImportRow {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ChildImport, (batch) => batch.rows, { onDelete: 'CASCADE' }) importBatch: ChildImport;
  @Column() rowNumber: number;
  @Column() kcfNumber: string;
  @Column({ type: 'jsonb' }) rawData: Record<string, unknown>;
  @Column({ type: 'jsonb' }) normalizedData: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'[]'" }) errors: string[];
  @Column({ type: 'jsonb', default: () => "'[]'" }) warnings: string[];
  @Column({ type: 'varchar' }) action: ImportAction;
  @Column({ default: false }) committed: boolean;
  @Column({ type: 'uuid', nullable: true }) childId: string | null;
  @CreateDateColumn() createdAt: Date;
}
