import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSponsorBirthdaySkipped1788019400000 implements MigrationInterface {
  name = 'AddSponsorBirthdaySkipped1788019400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "birthdaySkipped" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "birthdaySkipped"`,
    );
  }
}
