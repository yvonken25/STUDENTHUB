import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONTENT_STATUSES, type ContentStatus } from '../content.types';

/** Paramètres de recherche de l'API publique : ?q=bourse&category=Aides&limit=10 */
export class PublicQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Filtre de l'admin : ?status=REVIEW */
export class StaffQueryDto {
  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: ContentStatus;
}
