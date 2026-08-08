import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateSponsorDto } from './dto/create-sponsor.dto';

const BASE_URL = 'https://mailtrap.io';
const LIST_NAME = 'Sponsorship Inquiries';

const REQUIRED_FIELDS = [
  { name: 'Full Name', merge_tag: 'name', data_type: 'text' },
  { name: 'Phone Number', merge_tag: 'phone', data_type: 'text' },
  { name: 'Message', merge_tag: 'message', data_type: 'text' },
] as const;

@Injectable()
export class MailtrapContactsService implements OnModuleInit {
  private readonly logger = new Logger(MailtrapContactsService.name);
  private readonly token: string;
  private readonly accountId: string;
  private listId: number | null = null;

  constructor() {
    this.token = process.env.MAILTRAP_TOKEN!;
    this.accountId = process.env.MAILTRAP_ACCOUNT_ID!;
  }

  async onModuleInit(): Promise<void> {
    if (!this.accountId) {
      this.logger.warn('MAILTRAP_ACCOUNT_ID not set — contacts sync disabled');
      return;
    }
    try {
      await this.ensureCustomFields();
      await this.ensureContactList();
    } catch (err) {
      this.logger.error('Failed to bootstrap Mailtrap contacts setup', err);
    }
  }

  async upsertContact(dto: CreateSponsorDto): Promise<void> {
    if (!this.accountId) return;

    const fields: Record<string, string> = { name: dto.name };
    if (dto.phone) fields['phone'] = dto.phone;
    if (dto.message) fields['message'] = dto.message;

    const contact: Record<string, unknown> = { email: dto.email, fields };
    if (this.listId !== null) contact['list_ids'] = [this.listId];

    await this.fetchJson(`/api/accounts/${this.accountId}/contacts`, {
      method: 'POST',
      body: JSON.stringify({ contact }),
    });
  }

  private async ensureCustomFields(): Promise<void> {
    const res = await this.fetchJson<Array<{ merge_tag: string }>>(
      `/api/accounts/${this.accountId}/contacts/fields`,
      { method: 'GET' },
    );

    const existing = new Set(res?.map((f) => f.merge_tag));

    for (const field of REQUIRED_FIELDS) {
      if (existing.has(field.merge_tag)) continue;
      await this.fetchJson(`/api/accounts/${this.accountId}/contacts/fields`, {
        method: 'POST',
        body: JSON.stringify(field),
      });
      this.logger.log(`Created contact field: ${field.merge_tag}`);
    }
  }

  private async ensureContactList(): Promise<void> {
    const res = await this.fetchJson<Array<{ id: number; name: string }>>(
      `/api/accounts/${this.accountId}/contacts/lists`,
      { method: 'GET' },
    );

    const existing = res.find((l) => l.name === LIST_NAME);
    if (existing) {
      this.listId = existing.id;
      this.logger.log(`Using contact list "${LIST_NAME}" (id: ${this.listId})`);
      return;
    }

    const created = await this.fetchJson<{ id: number }>(
      `/api/accounts/${this.accountId}/contacts/lists`,
      { method: 'POST', body: JSON.stringify({ name: LIST_NAME }) },
    );
    this.listId = created.id;
    this.logger.log(`Created contact list "${LIST_NAME}" (id: ${this.listId})`);
  }

  private async fetchJson<T = unknown>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    this.logger.debug(`Mailtrap Contacts API request: ${init.method} ${path}`);
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      throw new Error(
        `Mailtrap Contacts API ${response.status} on ${init.method} ${path}: ${text}`,
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
