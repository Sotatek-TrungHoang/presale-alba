import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CoursesService } from '../../courses/courses.service';
import { PaginateCoursesDto } from '../../courses/dto/pagination-courses.dto';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { UpdateAdminCourseDto } from './dto/update-admin-course.dto';
import { CreateAdminCourseDto } from './dto/create-admin-course.dto';
import { AdminCoursesService } from './courses.service';

@ApiTags('admin')
@Controller('admin/courses')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly adminCoursesService: AdminCoursesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated list of golf courses (Admin only)',
    description:
      'Retrieve a paginated list of golf courses with course details including pricing, holes, par, and slope information. Requires Firebase authentication and admin privileges.',
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
    description: 'Number of items per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term to filter courses by name',
    example: 'royal',
  })
  findAllPaginated(@Query() paginateCoursesDto: PaginateCoursesDto) {
    return this.coursesService.findAllPaginated(paginateCoursesDto);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new golf course (Admin only)',
    description:
      'Create a new golf course with basic details. Tees and holes can be added separately using the update endpoint.',
  })
  create(@Body() createAdminCourseDto: CreateAdminCourseDto) {
    return this.adminCoursesService.createCourse(createAdminCourseDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific golf course by ID (Admin only)',
    description:
      'Retrieve detailed information about a specific golf course including tees, pricing, and course details. Requires Firebase authentication and admin privileges.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the golf course',
    example: '071031c3-55a2-4d52-b7ef-fd2ad0217823',
  })
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a golf course (Admin only)',
    description:
      'Update course details, tees, and holes. Supports updating existing tees/holes by ID and creating new tees/holes when IDs are omitted.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the golf course',
    example: '071031c3-55a2-4d52-b7ef-fd2ad0217823',
  })
  update(
    @Param('id') id: string,
    @Body() updateAdminCourseDto: UpdateAdminCourseDto,
  ) {
    return this.adminCoursesService.updateCourse(id, updateAdminCourseDto);
  }
}
