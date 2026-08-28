import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviseSponsorshipEmailFlow1788019200000 implements MigrationInterface {
  name = 'ReviseSponsorshipEmailFlow1788019200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "birthday" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "acknowledgmentSentAt" timestamptz`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "follow_up_settings"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "follow_up_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "delayMinutes" integer NOT NULL DEFAULT 4320,
      "updatedByUserId" uuid,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "acknowledgmentSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "birthday"`,
    );
  }
}
