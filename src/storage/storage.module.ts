import { Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { STORAGE_SERVICE } from './storage.types';

@Module({
  providers: [R2StorageService, { provide: STORAGE_SERVICE, useExisting: R2StorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
