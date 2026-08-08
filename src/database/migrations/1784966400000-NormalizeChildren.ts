import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeChildren1784966400000 implements MigrationInterface {
  name = 'NormalizeChildren1784966400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`ALTER TABLE "child" ADD COLUMN IF NOT EXISTS "kcfNumber" varchar`);
    await queryRunner.query(`ALTER TABLE "child" ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE "child" ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "child" ADD COLUMN IF NOT EXISTS "profileMediaId" uuid`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_child_kcf_number" ON "child" ("kcfNumber") WHERE "kcfNumber" IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE "child" DROP COLUMN IF EXISTS "age"`);
    for (const column of ['imageUrl', 'bio', 'subject', 'dream', 'hobby', 'personality', 'family', 'location', 'uniqueQuality']) {
      await queryRunner.query(`ALTER TABLE "child" ALTER COLUMN "${column}" DROP NOT NULL`);
    }

    await queryRunner.query(`CREATE TABLE "child_education" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "childId" uuid NOT NULL,
      "schoolName" varchar, "schoolLevel" varchar, "yearGroup" varchar,
      "startedAt" date, "endedAt" date, "isCurrent" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_child_education_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_child_current_education" ON "child_education" ("childId", "isCurrent") WHERE "isCurrent" = true`);
    await queryRunner.query(`INSERT INTO "child_education" ("childId","schoolName","schoolLevel","yearGroup")
      SELECT "id","schoolName","schoolLevel","schoolYearGroup" FROM "child"
      WHERE "schoolName" IS NOT NULL OR "schoolLevel" IS NOT NULL OR "schoolYearGroup" IS NOT NULL`);

    await queryRunner.query(`CREATE TABLE "child_guardian" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "childId" uuid NOT NULL,
      "name" varchar, "relationship" varchar NOT NULL, "phone" varchar, "email" varchar,
      "isPrimary" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_child_guardian_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`INSERT INTO "child_guardian" ("childId","name","relationship")
      SELECT "id","guardianName",COALESCE("guardianRelationship",'Unknown') FROM "child"
      WHERE "guardianName" IS NOT NULL OR "guardianRelationship" IS NOT NULL`);

    await queryRunner.query(`CREATE TABLE "child_consent" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "childId" uuid NOT NULL,
      "type" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'pending',
      "effectiveAt" timestamptz NOT NULL DEFAULT now(), "notes" varchar, "recordedByUserId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_child_consent_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`INSERT INTO "child_consent" ("childId","type","status")
      SELECT "id",'guardian',CASE WHEN "guardianConsent" THEN 'granted' ELSE 'denied' END FROM "child"`);
    await queryRunner.query(`INSERT INTO "child_consent" ("childId","type","status")
      SELECT "id",'photo',CASE WHEN "photoConsentStatus" THEN 'granted' ELSE 'denied' END FROM "child"`);

    await queryRunner.query(`CREATE TABLE "child_media" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "childId" uuid NOT NULL,
      "category" varchar NOT NULL, "objectKey" varchar NOT NULL UNIQUE, "originalName" varchar NOT NULL,
      "mimeType" varchar NOT NULL, "sizeBytes" bigint NOT NULL, "checksum" varchar, "caption" varchar,
      "archivedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_child_media_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "child_import" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "originalFilename" varchar NOT NULL, "fileHash" varchar NOT NULL,
      "uploadedByUserId" uuid NOT NULL, "status" varchar NOT NULL DEFAULT 'previewed',
      "totalRows" int NOT NULL DEFAULT 0, "createCount" int NOT NULL DEFAULT 0, "updateCount" int NOT NULL DEFAULT 0,
      "unchangedCount" int NOT NULL DEFAULT 0, "invalidCount" int NOT NULL DEFAULT 0, "committedCount" int NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE "child_import_row" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "importBatchId" uuid NOT NULL, "rowNumber" int NOT NULL,
      "kcfNumber" varchar NOT NULL, "rawData" jsonb NOT NULL, "normalizedData" jsonb NOT NULL,
      "errors" jsonb NOT NULL DEFAULT '[]', "warnings" jsonb NOT NULL DEFAULT '[]', "action" varchar NOT NULL,
      "committed" boolean NOT NULL DEFAULT false, "childId" uuid, "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_child_import_row" UNIQUE ("importBatchId","rowNumber"),
      CONSTRAINT "FK_child_import_row_batch" FOREIGN KEY ("importBatchId") REFERENCES "child_import"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "audit_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "action" varchar NOT NULL,
      "entityType" varchar NOT NULL, "entityId" uuid NOT NULL, "actorUserId" uuid,
      "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_import_row"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_import"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_consent"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_guardian"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "child_education"`);
    await queryRunner.query(`ALTER TABLE "child" ADD COLUMN IF NOT EXISTS "age" integer`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_child_kcf_number"`);
    await queryRunner.query(`ALTER TABLE "child" DROP COLUMN IF EXISTS "profileMediaId"`);
    await queryRunner.query(`ALTER TABLE "child" DROP COLUMN IF EXISTS "archivedAt"`);
    await queryRunner.query(`ALTER TABLE "child" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "child" DROP COLUMN IF EXISTS "kcfNumber"`);
  }
}
