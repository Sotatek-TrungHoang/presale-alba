import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  Patch,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from '../../users/users.service';
import { AdminUsersService } from './users.service';
import { PaginateUsersDto } from '../../users/dto/pagination-users.dto';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

@ApiTags('admin')
@Controller('admin/users')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminUsersService: AdminUsersService,
  ) {}

  @Get('check-admin')
  @ApiOperation({
    summary: 'Check if current user is an admin',
    description:
      'Verifies if the authenticated user has admin privileges. Returns 200 if admin, 403 if not.',
  })
  checkAdmin() {
    return { isAdmin: true };
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated users (Admin only)',
    description:
      'Retrieve a paginated list of all non-deleted users with their profiles and onboarding data. Requires Firebase authentication and admin privileges.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starting from 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search term to filter users by email, first name, or last name',
    example: 'john',
  })
  findAllPaginated(@Query() paginateUsersDto: PaginateUsersDto) {
    return this.usersService.findAllPaginated(paginateUsersDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific user by ID (Admin only)',
    description:
      'Retrieve detailed information about a specific user including profile, onboarding data, and statistics. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the user',
    example: 'clh1234567890',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user (Admin only)',
    description:
      'Update user details including admin status and profile information. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the user',
    example: 'clh1234567890',
  })
  updateUser(
    @Param('id') id: string,
    @Body() updateUserAdminDto: UpdateUserAdminDto,
  ) {
    return this.adminUsersService.updateUser(id, updateUserAdminDto);
  }
}
