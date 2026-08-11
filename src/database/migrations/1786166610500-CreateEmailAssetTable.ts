import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Uploaded images for use in email templates (logo, group photos, etc.),
 * stored in R2 under a public objectKey/url — separate from child_media,
 * which is scoped to a required childId and only ever exposed via
 * short-lived signed URLs (unsuitable for an image baked into a sent email
 * that may be opened long after upload).
 */
export class CreateEmailAssetTable1786166610500 implements MigrationInterface {
  name = 'CreateEmailAssetTable1786166610500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "email_asset" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "objectKey" varchar NOT NULL,
      "url" varchar NOT NULL,
      "filename" varchar NOT NULL,
      "mimeType" varchar NOT NULL,
      "sizeBytes" bigint NOT NULL,
      "uploadedByUserId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_asset_object_key"
      ON "email_asset" ("objectKey")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_asset"`);
  }
}
