import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds:
 * - `follow_up_settings`, a singleton-row table holding the admin-configurable
 *   delay (in days) before the sponsor.profile-reminder follow-up email
 *   fires, replacing a hardcoded interval in FollowUpService.
 * - four free-text preference columns on `sponsor`, plus
 *   `preferencesCompletedAt`, backing the new sponsor-portal preferences page.
 */
export class AddFollowUpSettingsAndSponsorPreferences1785939816650
  implements MigrationInterface
{
  name = 'AddFollowUpSettingsAndSponsorPreferences1785939816650';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "follow_up_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "delayDays" integer NOT NULL DEFAULT 3,
      "updatedByUserId" uuid,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "follow_up_settings" ("delayDays")
      SELECT 3 WHERE NOT EXISTS (SELECT 1 FROM "follow_up_settings")`);

    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "childInterests" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "schoolGoals" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "hobbiesAndTalents" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "communicationPreferences" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "preferencesCompletedAt" timestamptz`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "preferencesCompletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "communicationPreferences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "hobbiesAndTalents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "schoolGoals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "childInterests"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "follow_up_settings"`);
  }
}
