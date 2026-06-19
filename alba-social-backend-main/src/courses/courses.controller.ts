import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
  StreamableFile,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SearchCoursesDto } from './dto/search-courses.dto';
import { SearchCoursesLocationsDto } from './dto/search-courses-locations.dto';
import { AddReviewDto } from './dto/add-review.dto';
import { FindCoursesByLocationDto } from './dto/find-courses-by-location.dto';
import { AddConditionReportDto } from './dto/add-condition-report.dto';
import { ToggleFavouriteCourseDto } from './dto/toggle-favourite-course.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';
import { createReadStream } from 'node:fs';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('review')
  async addReview(@Request() req, @Body() addReviewDto: AddReviewDto) {
    return this.coursesService.addReview(req.user.uid, addReviewDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('condition-report')
  async addConditionReport(
    @Request() req,
    @Body() addConditionReportDto: AddConditionReportDto,
  ) {
    return this.coursesService.addConditionReport(
      req.user.uid,
      addConditionReportDto,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('toggle-favourite')
  async toggleFavouriteCourse(
    @Request() req,
    @Body() toggleFavouriteCourseDto: ToggleFavouriteCourseDto,
  ) {
    return this.coursesService.toggleFavouriteCourse(
      req.user.uid,
      toggleFavouriteCourseDto,
    );
  }

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get('search')
  async searchCourses(@Query() searchCoursesDto: SearchCoursesDto) {
    return this.coursesService.searchCourses(searchCoursesDto);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="golf_courses.csv"')
  async exportCsv(): Promise<StreamableFile> {
    try {
      const filePath = await this.coursesService.exportToCsv();
      const file = createReadStream(filePath);

      // Cleanup after stream ends
      file.on('end', () => {
        this.coursesService.cleanupFile(filePath);
      });

      return new StreamableFile(file);
    } catch (error) {
      console.error('Error in export endpoint:', error);
      throw error;
    }
  }

  @Get('search-with-location')
  async searchCoursesAndLocations(
    @Query() searchCoursesLocationsDto: SearchCoursesLocationsDto,
  ) {
    return this.coursesService.searchCoursesAndLocations(
      searchCoursesLocationsDto,
    );
  }

  @Get('by-location')
  async getCoursesByLocation(
    @Query() findCoursesByLocationDto: FindCoursesByLocationDto,
  ) {
    return this.coursesService.findCoursesByLocation(findCoursesByLocationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get(':id/games')
  findGames(@Param('id') id: string) {
    return this.coursesService.findGames(id);
  }

  @Get(':id/tees')
  findTees(@Param('id') id: string) {
    return this.coursesService.findTees(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(+id, updateCourseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(+id);
  }
}
