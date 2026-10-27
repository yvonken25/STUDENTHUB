import { IsIn } from 'class-validator';
import {
  CONTENT_VISIBILITIES,
  type ContentVisibility,
} from '../content.types';

export class ChangeVisibilityDto {
  @IsIn(CONTENT_VISIBILITIES)
  visibility: ContentVisibility;
}
