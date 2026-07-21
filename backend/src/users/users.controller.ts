import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.usersService.findAll(user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.companyId, dto);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.companyId, id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.usersService.remove(user.companyId, id, user.sub);
  }
}
