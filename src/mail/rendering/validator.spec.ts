import { validateTemplateSource } from './validator';
import { TriggerDataField } from '../registry/mail-trigger.types';

const dataSchema: TriggerDataField[] = [
  {
    name: 'user.firstName',
    type: 'string',
    description: 'First name',
    example: 'Aline',
  },
  {
    name: 'inviteUrl',
    type: 'string',
    description: 'Invite link',
    example: 'https://x/invite',
  },
  { name: 'expiresInHours', type: 'number', description: 'TTL', example: 24 },
];

describe('validateTemplateSource', () => {
  it('accepts a well-formed template referencing only declared and global variables', () => {
    const result = validateTemplateSource(
      'Hello {{user.firstName}}',
      '<p>Visit {{inviteUrl}} within {{expiresInHours}} hours. {{currentYear}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an unknown variable and suggests the closest declared one', () => {
    const result = validateTemplateSource(
      'Hello {{user.fistName}}',
      '<p>static</p>',
      dataSchema,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_VARIABLE',
        message: expect.stringContaining(
          "Did you mean 'user.firstName'?",
        ) as string,
      }),
    );
  });

  it('rejects a helper outside the allowlist', () => {
    const result = validateTemplateSource(
      'Subject',
      '<p>{{sneakyHelper user.firstName}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_HELPER' }),
    );
  });

  it('accepts allowlisted built-in and custom helpers', () => {
    const result = validateTemplateSource(
      'Subject',
      '<p>{{#if user.firstName}}{{uppercase user.firstName}}{{/if}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects raw/triple-stash output in staff-authored content', () => {
    const result = validateTemplateSource(
      'Subject',
      '<p>{{{inviteUrl}}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'RAW_HTML_NOT_ALLOWED' }),
    );
  });

  it('surfaces a Handlebars syntax error with a line number', () => {
    const result = validateTemplateSource(
      'Subject',
      '<p>{{#if user.firstName}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('SYNTAX_ERROR');
    expect(result.errors[0].line).toBeGreaterThan(0);
  });

  it('warns about a declared variable that is never referenced', () => {
    const result = validateTemplateSource(
      'Subject',
      '<p>{{user.firstName}}</p>',
      dataSchema,
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'UNUSED_VARIABLE',
        message: expect.stringContaining('inviteUrl') as string,
      }),
    );
  });

  it('flags output that exceeds the size cap', () => {
    const huge: TriggerDataField[] = [
      {
        name: 'blob',
        type: 'string',
        description: '',
        example: 'x'.repeat(600_000),
      },
    ];
    const result = validateTemplateSource('Subject', '<p>{{blob}}</p>', huge);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'OUTPUT_TOO_LARGE' }),
    );
  });
});
