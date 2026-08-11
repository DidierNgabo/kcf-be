import { BadRequestException } from '@nestjs/common';
import { ChildMediaService } from './child-media.service';
import { MediaCategory } from './enums/child.enums';

describe('ChildMediaService', () => {
  const child = { id: '11111111-1111-1111-1111-111111111111' };
  const storage = {
    createUploadUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
    createDownloadUrl: jest.fn(),
    verifyObject: jest.fn(),
    copyObject: jest.fn(),
    getPublicUrl: jest.fn(),
  };
  const childRepo = { findOne: jest.fn().mockResolvedValue(child), save: jest.fn(), update: jest.fn() };
  const mediaRepo = { create: jest.fn((value) => value), save: jest.fn(), findOne: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn((_key, fallback) => fallback) };
  const service = new ChildMediaService(mediaRepo as never, childRepo as never, storage, audit as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  it('creates a server-controlled child-scoped object key', async () => {
    const result = await service.requestUpload(child.id, {
      filename: '../../private photo.jpg', mimeType: 'image/jpeg',
      sizeBytes: 1024, category: MediaCategory.PROFILE,
    });
    expect(result.objectKey).toMatch(new RegExp(`^children/${child.id}/\\d{4}/[0-9a-f-]+\\.jpg$`));
    expect(result.objectKey).not.toContain('private photo');
    expect(storage.createUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ objectKey: result.objectKey }));
  });

  it('rejects unsupported content and oversized files before signing', async () => {
    await expect(service.requestUpload(child.id, {
      filename: 'script.html', mimeType: 'text/html', sizeBytes: 10, category: MediaCategory.DOCUMENT,
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.requestUpload(child.id, {
      filename: 'large.pdf', mimeType: 'application/pdf', sizeBytes: 21 * 1024 * 1024, category: MediaCategory.DOCUMENT,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
