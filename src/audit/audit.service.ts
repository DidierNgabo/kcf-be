import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}
  record(action: string, entityType: string, entityId: string, actorUserId?: string, metadata: Record<string, unknown> = {}, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    return repo.save(repo.create({ action, entityType, entityId, actorUserId: actorUserId ?? null, metadata }));
  }
}
