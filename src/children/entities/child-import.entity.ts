import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ImportStatus } from '../enums/child.enums';
import { ChildImportRow } from './child-import-row.entity';

@Entity('child_import')
export class ChildImport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() originalFilename: string;
  @Column() fileHash: string;
  @Column({ type: 'uuid' }) uploadedByUserId: string;
  @Column({ type: 'varchar', default: ImportStatus.PREVIEWED }) status: ImportStatus;
  @Column({ default: 0 }) totalRows: number;
  @Column({ default: 0 }) createCount: number;
  @Column({ default: 0 }) updateCount: number;
  @Column({ default: 0 }) unchangedCount: number;
  @Column({ default: 0 }) invalidCount: number;
  @Column({ default: 0 }) committedCount: number;
  @OneToMany(() => ChildImportRow, (row) => row.importBatch) rows: ChildImportRow[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
