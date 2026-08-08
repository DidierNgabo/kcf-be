import { IsIn, IsUUID } from 'class-validator';

export type BroadcastAudience = 'all' | 'matched' | 'unmatched';

export class BroadcastSendDto {
  @IsUUID() versionId: string;

  @IsIn(['all', 'matched', 'unmatched']) audience: BroadcastAudience;
}
