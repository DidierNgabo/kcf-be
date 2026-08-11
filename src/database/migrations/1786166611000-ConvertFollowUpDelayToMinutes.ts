import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces `follow_up_settings.delayDays` (whole days only) with
 * `delayMinutes`, so the admin-configurable follow-up delay can be set down
 * to the minute (e.g. 5/10/30 minutes) instead of only in day increments.
 * Existing values are converted 1:1 (days * 1440) so nobody's configured
 * delay silently changes.
 */
export class ConvertFollowUpDelayToMinutes1786166611000 implements MigrationInterface {
  name = 'ConvertFollowUpDelayToMinutes1786166611000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ADD COLUMN IF NOT EXISTS "delayMinutes" integer`,
    );
    await queryRunner.query(
      `UPDATE "follow_up_settings" SET "delayMinutes" = "delayDays" * 1440 WHERE "delayMinutes" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ALTER COLUMN "delayMinutes" SET DEFAULT 4320`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ALTER COLUMN "delayMinutes" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" DROP COLUMN IF EXISTS "delayDays"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ADD COLUMN IF NOT EXISTS "delayDays" integer`,
    );
    await queryRunner.query(
      `UPDATE "follow_up_settings" SET "delayDays" = GREATEST(1, "delayMinutes" / 1440) WHERE "delayDays" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ALTER COLUMN "delayDays" SET DEFAULT 3`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" ALTER COLUMN "delayDays" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow_up_settings" DROP COLUMN IF EXISTS "delayMinutes"`,
    );
  }
}
