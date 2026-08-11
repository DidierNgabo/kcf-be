import { BadRequestException } from '@nestjs/common';
import { EmailAssetsService } from './email-assets.service';

describe('EmailAssetsService', () => {
  const storage = {
    createUploadUrl: jest
      .fn()
      .mockResolvedValue('https://signed.example/upload'),
    createDownloadUrl: jest.fn(),
    verifyObject: jest
      .fn()
      .mockResolvedValue({ sizeBytes: 1024, mimeType: 'image/png' }),
    copyObject: jest.fn(),
    getPublicUrl: jest.fn(
      (objectKey: string) => `https://pub-example.r2.dev/${objectKey}`,
    ),
  };
  const assetRepo = {
    create: jest.fn((value: object) => value),
    save: jest.fn((value: object) =>
      Promise.resolve({ id: 'asset-1', ...value }),
    ),
    find: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'STORAGE_PUBLIC_BASE_URL'
        ? 'https://pub-example.r2.dev'
        : fallback,
    ),
  };
  const service = new EmailAssetsService(
    assetRepo as never,
    storage,
    audit as never,
    config as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a server-controlled object key under email-assets/ and returns the public url', async () => {
    const result = await service.requestUpload({
      filename: '../../logo photo.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
    });
    expect(result.objectKey).toMatch(/^email-assets\/\d{4}\/[0-9a-f-]+\.png$/);
    expect(result.objectKey).not.toContain('logo photo');
    expect(result.url).toBe(`https://pub-example.r2.dev/${result.objectKey}`);
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: result.objectKey }),
    );
  });

  it('rejects unsupported content and oversized files before signing', async () => {
    await expect(
      service.requestUpload({
        filename: 'a.html',
        mimeType: 'text/html',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.requestUpload({
        filename: 'huge.png',
        mimeType: 'image/png',
        sizeBytes: 6 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm rejects an object key outside the email-assets/ prefix', async () => {
    await expect(
      service.confirm({
        objectKey: 'children/123/2026/x.png',
        filename: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm rejects when the verified object does not match the declared metadata', async () => {
    storage.verifyObject.mockResolvedValueOnce({
      sizeBytes: 999,
      mimeType: 'image/png',
    });
    await expect(
      service.confirm({
        objectKey: 'email-assets/2026/x.png',
        filename: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm persists the asset with its public url and audits the upload', async () => {
    const asset = await service.confirm(
      {
        objectKey: 'email-assets/2026/x.png',
        filename: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      },
      'user-1',
    );
    expect(asset).toEqual(
      expect.objectContaining({
        objectKey: 'email-assets/2026/x.png',
        url: 'https://pub-example.r2.dev/email-assets/2026/x.png',
        uploadedByUserId: 'user-1',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      'mail_asset.uploaded',
      'email_asset',
      'asset-1',
      'user-1',
      expect.objectContaining({ filename: 'a.png' }),
    );
  });

  it('list returns the repo results as-is', async () => {
    assetRepo.find.mockResolvedValue([{ id: 'asset-1' }]);
    const result = await service.list();
    expect(result).toEqual([{ id: 'asset-1' }]);
    expect(assetRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: 'DESC' }, take: 100 }),
    );
  });
});
