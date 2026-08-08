import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Captures the pre-migration schema so a new environment and an existing
 * synchronized database can both enter the explicit migration lifecycle.
 * IF NOT EXISTS makes adoption safe for the existing production database.
 */
export class BaselineExistingSchema1784966300000 implements MigrationInterface {
  name = 'BaselineExistingSchema1784966300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "child" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar NOT NULL, "age" integer NOT NULL,
      "gender" varchar, "dateOfBirth" date, "imageUrl" varchar NOT NULL, "bio" text NOT NULL,
      "subject" varchar NOT NULL, "dream" varchar NOT NULL, "hobby" varchar NOT NULL,
      "personality" varchar NOT NULL, "family" varchar NOT NULL, "location" varchar NOT NULL,
      "uniqueQuality" text NOT NULL, "schoolName" varchar, "schoolLevel" varchar, "schoolYearGroup" varchar,
      "enrolmentDate" date, "guardianName" varchar, "guardianRelationship" varchar,
      "guardianConsent" boolean NOT NULL DEFAULT false, "photoConsentStatus" boolean NOT NULL DEFAULT false,
      "sponsorshipStartDate" date, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sponsor" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar NOT NULL, "email" varchar NOT NULL UNIQUE,
      "phone" varchar, "message" varchar, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "followUpSentAt" timestamptz, "childId" uuid,
      CONSTRAINT "FK_sponsor_child" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar NOT NULL UNIQUE,
      "password" varchar NOT NULL, "name" varchar NOT NULL, "role" varchar NOT NULL DEFAULT 'staff',
      "isActive" boolean NOT NULL DEFAULT true, "sponsorId" uuid UNIQUE,
      "passwordResetTokenHash" varchar, "passwordResetExpiresAt" timestamptz, "passwordChangedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(): Promise<void> {
    // Baseline adoption is intentionally non-destructive.
  }
}
