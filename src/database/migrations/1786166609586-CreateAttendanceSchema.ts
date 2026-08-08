import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Attendance is tracked as a full roster per gathering day: `attendance_day`
 * rows are created lazily (only once someone is marked present for that
 * date), and `attendance_record` rows mark which children were there.
 * Absence is computed, not stored — a roster is "everyone active minus who
 * has a record for that day."
 */
export class CreateAttendanceSchema1786166609586 implements MigrationInterface {
  name = 'CreateAttendanceSchema1786166609586';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "attendance_day" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "date" date NOT NULL,
      "label" text,
      "notes" text,
      "createdByUserId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_day_date"
      ON "attendance_day" ("date")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "attendance_record" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "attendanceDayId" uuid NOT NULL,
      "childId" uuid NOT NULL,
      "markedByUserId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_attendance_record_day" FOREIGN KEY ("attendanceDayId") REFERENCES "attendance_day"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_attendance_record_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_record_day_child"
      ON "attendance_record" ("attendanceDayId", "childId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_attendance_record_child"
      ON "attendance_record" ("childId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_record"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_day"`);
  }
}
