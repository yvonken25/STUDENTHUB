import { IsIn } from 'class-validator';
import { CONTENT_STATUSES, type ContentStatus } from '../content.types';

export class ChangeStatusDto {
  @IsIn(CONTENT_STATUSES)
  status: ContentStatus;
}
