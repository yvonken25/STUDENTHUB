import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { StaffGuard, type StaffUser } from '../auth/staff.guard';
import { ContentsService } from './contents.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ChangeVisibilityDto } from './dto/change-visibility.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { StaffQueryDto } from './dto/queries.dto';
import { UpdateContentDto } from './dto/update-content.dto';

/** API d'administration : token Supabase + rôle EDITOR ou ADMIN obligatoires. */
@Controller('contents')
@UseGuards(StaffGuard)
export class ContentsController {
  constructor(private readonly contents: ContentsService) {}

  @Get()
  list(@Query() query: StaffQueryDto) {
    return this.contents.listForStaff(query.status);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contents.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() user: StaffUser) {
    return this.contents.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contents.update(id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.contents.changeStatus(id, dto.status);
  }

  @Patch(':id/visibility')
  changeVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVisibilityDto,
  ) {
    return this.contents.changeVisibility(id, dto.visibility);
  }
}
