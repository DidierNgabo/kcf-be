import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expands attendance_record from binary presence (row exists = present) to
 * four explicit statuses (present/late/absent/excused) plus an optional
 * note. Every row that already exists today only ever meant "present," so
 * defaulting the new column to 'present' is correct for existing data.
 */
export class AddAttendanceStatusAndNote1786166609999
  implements MigrationInterface
{
  name = 'AddAttendanceStatusAndNote1786166609999';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_record"
      ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'present'`);
    await queryRunner.query(`ALTER TABLE "attendance_record"
      ADD COLUMN IF NOT EXISTS "note" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_record" DROP COLUMN IF EXISTS "note"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_record" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
