import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds ad-hoc "broadcast" templates (staff-authored newsletters/updates with
 * no code trigger behind them) alongside the existing code-trigger-backed
 * templates, plus a basic sponsor unsubscribe mechanism so broadcasts have
 * an opt-out.
 *
 * `email_template` previously enforced one row per (triggerKey, locale,
 * channel) via a plain unique index. Broadcasts all share one reserved
 * triggerKey ('manual.broadcast') but many campaigns must coexist, so the
 * index is narrowed to a partial index that only applies to kind='trigger'
 * rows — the coded triggers keep their original one-template guarantee,
 * broadcasts are exempt.
 */
export class AddBroadcastAndUnsubscribe1785143598028
  implements MigrationInterface
{
  name = 'AddBroadcastAndUnsubscribe1785143598028';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_template" ADD COLUMN IF NOT EXISTS "kind" varchar NOT NULL DEFAULT 'trigger'`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_template" ADD COLUMN IF NOT EXISTS "name" varchar`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_email_template_trigger_locale_channel"`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_trigger_locale_channel"
      ON "email_template" ("triggerKey", "locale", "channel") WHERE "kind" = 'trigger'`);

    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "unsubscribed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "unsubscribedAt" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" ADD COLUMN IF NOT EXISTS "unsubscribeToken" uuid NOT NULL DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sponsor_unsubscribe_token"
      ON "sponsor" ("unsubscribeToken")`);

    await queryRunner.query(`INSERT INTO "email_layout" ("key", "name", "bodyHtml") VALUES (
      'broadcast',
      'Broadcast (with unsubscribe footer)',
      '{{{body}}}<hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5;"><p style="font-size:12px;color:#888;text-align:center;font-family:Arial,Helvetica,sans-serif;">You''re receiving this because you''re a sponsor of Kwizera Charity Foundation. <a href="{{{unsubscribeUrl}}}">Unsubscribe from update emails</a></p>'
    ) ON CONFLICT ("key") DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_layout" WHERE "key" = 'broadcast'`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sponsor_unsubscribe_token"`);
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "unsubscribeToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "unsubscribedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sponsor" DROP COLUMN IF EXISTS "unsubscribed"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_email_template_trigger_locale_channel"`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_email_template_trigger_locale_channel"
      ON "email_template" ("triggerKey", "locale", "channel")`);

    await queryRunner.query(
      `ALTER TABLE "email_template" DROP COLUMN IF EXISTS "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_template" DROP COLUMN IF EXISTS "kind"`,
    );
  }
}
