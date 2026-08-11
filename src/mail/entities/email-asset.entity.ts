import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('email_asset')
@Index(['objectKey'], { unique: true })
export class EmailAsset {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() objectKey: string;
  // The permanent public URL (STORAGE_PUBLIC_BASE_URL + objectKey) — unlike
  // child media, email images are embedded in documents that go on being
  // opened long after upload, so a short-lived signed URL isn't usable here.
  @Column() url: string;
  @Column() filename: string;
  @Column() mimeType: string;
  @Column({ type: 'bigint' }) sizeBytes: string;
  @Column({ type: 'uuid', nullable: true }) uploadedByUserId: string | null;
  @CreateDateColumn() createdAt: Date;
}
