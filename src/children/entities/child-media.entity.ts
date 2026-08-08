import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Child } from './child.entity';
import { MediaCategory } from '../enums/child.enums';

@Entity('child_media')
@Index(['objectKey'], { unique: true })
export class ChildMedia {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Child, (child) => child.media, { onDelete: 'CASCADE' }) child: Child;
  @Column({ type: 'varchar' }) category: MediaCategory;
  @Column() objectKey: string;
  @Column() originalName: string;
  @Column() mimeType: string;
  @Column({ type: 'bigint' }) sizeBytes: string;
  @Column({ type: 'varchar', nullable: true }) checksum: string | null;
  @Column({ type: 'varchar', nullable: true }) caption: string | null;
  @Column({ type: 'timestamptz', nullable: true }) archivedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
