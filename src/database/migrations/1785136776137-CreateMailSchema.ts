import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The 7 existing .hbs templates being migrated are already complete,
 * self-contained HTML documents (their own <html>/<head>/<style>), not
 * fragments meant to be wrapped. So the seeded default layout is an
 * identity passthrough (`{{{body}}}` only) — this preserves byte-for-byte
 * rendering parity with the legacy renderer. A real branded wrapper layout
 * can be introduced later once templates are authored as fragments.
 */
export class CreateMailSchema1785136776137 implements MigrationInterface {
  name = 'CreateMailSchema1785136776137';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "email_layout" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "key" varchar NOT NULL UNIQUE,
      "name" varchar NOT NULL,
      "bodyHtml" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "email_template" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "triggerKey" varchar NOT NULL,
      "locale" varchar NOT NULL DEFAULT 'default',
      "channel" varchar NOT NULL DEFAULT 'email',
      "layoutId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_email_template_layout" FOREIGN KEY ("layoutId") REFERENCES "email_layout"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_trigger_locale_channel"
      ON "email_template" ("triggerKey", "locale", "channel")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "email_template_version" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "templateId" uuid NOT NULL,
      "versionNumber" integer,
      "status" varchar NOT NULL DEFAULT 'draft',
      "subject" varchar(500) NOT NULL,
      "bodyHtml" text NOT NULL,
      "sampleData" jsonb NOT NULL DEFAULT '{}',
      "createdByUserId" uuid,
      "publishedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_email_template_version_template" FOREIGN KEY ("templateId") REFERENCES "email_template"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_version_number"
      ON "email_template_version" ("templateId", "versionNumber")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_version_draft"
      ON "email_template_version" ("templateId") WHERE "status" = 'draft'`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_version_published"
      ON "email_template_version" ("templateId") WHERE "status" = 'published'`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "email_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "triggerKey" varchar NOT NULL,
      "templateId" uuid,
      "versionId" uuid,
      "locale" varchar NOT NULL DEFAULT 'default',
      "recipientEmail" varchar NOT NULL,
      "subjectRendered" varchar,
      "payload" jsonb NOT NULL DEFAULT '{}',
      "status" varchar NOT NULL DEFAULT 'queued',
      "attemptCount" integer NOT NULL DEFAULT 0,
      "errorMessage" text,
      "providerMessageId" varchar,
      "isTest" boolean NOT NULL DEFAULT false,
      "queuedAt" timestamptz NOT NULL DEFAULT now(),
      "sentAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_email_log_trigger_key" ON "email_log" ("triggerKey")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_email_log_status" ON "email_log" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_email_log_created_at" ON "email_log" ("createdAt")`);

    await queryRunner.query(`INSERT INTO "email_layout" ("key", "name", "bodyHtml")
      VALUES ('default', 'Default (passthrough)', '{{{body}}}')
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_template_version"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_template"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_layout"`);
  }
}
