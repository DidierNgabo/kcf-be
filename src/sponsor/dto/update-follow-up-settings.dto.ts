import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Max of 43200 minutes (30 days) mirrors the previous day-based cap.
export class UpdateFollowUpSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  delayMinutes: number;
}
