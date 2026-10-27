import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentsService } from './contents.service';
import { PublicQueryDto } from './dto/queries.dto';

/** API publique : sans authentification. C'est celle que WordPress consomme. */
@Controller('public/contents')
export class PublicContentsController {
  constructor(private readonly contents: ContentsService) {}

  @Get()
  list(@Query() query: PublicQueryDto) {
    return this.contents.listPublic(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.contents.findPublicBySlug(slug);
  }
}
