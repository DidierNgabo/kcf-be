import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSponsorGenderPreference1788019300000 implements MigrationInterface {
  name = 'AddSponsorGenderPreference1788019300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "childGenderPreference" varchar`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "childGenderPreference"`,
    );
  }
}
