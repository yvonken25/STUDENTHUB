import { Module } from '@nestjs/common';
import { ContentsController } from './contents.controller';
import { ContentsService } from './contents.service';
import { PublicContentsController } from './public-contents.controller';

@Module({
  controllers: [PublicContentsController, ContentsController],
  providers: [ContentsService],
})
export class ContentsModule {}
