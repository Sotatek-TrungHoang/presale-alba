import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CourseTee } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../../courses/courses.service';
import { UpdateAdminCourseDto } from './dto/update-admin-course.dto';
import { CreateAdminCourseDto } from './dto/create-admin-course.dto';

@Injectable()
export class AdminCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async createCourse(createAdminCourseDto: CreateAdminCourseDto) {
    const courseData: Prisma.GolfCourseCreateInput = {
      name: createAdminCourseDto.name,
      lat: createAdminCourseDto.lat ?? null,
      lng: createAdminCourseDto.lng ?? null,
      address: createAdminCourseDto.address ?? null,
      saturday_9am_cost_pence:
        createAdminCourseDto.saturday_9am_cost_pence ?? null,
      is_bookable: createAdminCourseDto.is_bookable ?? false,
      closed_down: createAdminCourseDto.closed_down ?? false,
      booking_url: createAdminCourseDto.booking_url ?? null,
    };

    const createdCourse = await this.prisma.golfCourse.create({
      data: courseData,
    });

    await this.coursesService.invalidateCache();
    return createdCourse;
  }

  async updateCourse(id: string, updateAdminCourseDto: UpdateAdminCourseDto) {
    const existingCourse = await this.prisma.golfCourse.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      throw new NotFoundException('Course not found');
    }

    const { tees, ...courseData } = updateAdminCourseDto;
    const courseUpdateData: Prisma.GolfCourseUpdateInput = {};

    if (courseData.name !== undefined) {
      courseUpdateData.name = courseData.name;
    }
    if (courseData.lat !== undefined) {
      courseUpdateData.lat = courseData.lat;
    }
    if (courseData.lng !== undefined) {
      courseUpdateData.lng = courseData.lng;
    }
    if (courseData.address !== undefined) {
      courseUpdateData.address = courseData.address;
    }
    if (courseData.saturday_9am_cost_pence !== undefined) {
      courseUpdateData.saturday_9am_cost_pence =
        courseData.saturday_9am_cost_pence;
    }
    if (courseData.is_bookable !== undefined) {
      courseUpdateData.is_bookable = courseData.is_bookable;
    }
    if (courseData.closed_down !== undefined) {
      courseUpdateData.closed_down = courseData.closed_down;
    }
    if (courseData.booking_url !== undefined) {
      courseUpdateData.booking_url = courseData.booking_url;
    }
    if (courseData.deleted !== undefined) {
      courseUpdateData.deleted_at = courseData.deleted ? new Date() : null;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(courseUpdateData).length > 0) {
        await tx.golfCourse.update({
          where: { id },
          data: courseUpdateData,
        });
      }

      if (courseData.deleted !== undefined) {
        const deletedAt = courseData.deleted ? new Date() : null;
        await tx.courseTee.updateMany({
          where: { course_id: id },
          data: { deleted_at: deletedAt },
        });
        await tx.courseHole.updateMany({
          where: { tee: { course_id: id } },
          data: { deleted_at: deletedAt },
        });
      }

      if (!tees || tees.length === 0) {
        return;
      }

      for (const tee of tees) {
        const teeUpdateData: Record<string, unknown> = {};

        if (tee.tee_name !== undefined) {
          teeUpdateData.tee_name = tee.tee_name;
        }
        if (tee.rating !== undefined) {
          teeUpdateData.rating = tee.rating;
        }
        if (tee.slope !== undefined) {
          teeUpdateData.slope = tee.slope;
        }
        if (tee.deleted !== undefined) {
          teeUpdateData.deleted_at = tee.deleted ? new Date() : null;
        }

        let savedTee: CourseTee;
        if (tee.id) {
          savedTee = await tx.courseTee.update({
            where: { id: tee.id },
            data: teeUpdateData as Prisma.CourseTeeUpdateInput,
          });
        } else {
          if (!tee.tee_name) {
            throw new BadRequestException(
              'tee_name is required when creating a new tee',
            );
          }

          const existingTee = await tx.courseTee.findFirst({
            where: {
              course_id: id,
              tee_name: tee.tee_name,
              deleted_at: null,
            } as Prisma.CourseTeeWhereInput,
          });

          if (existingTee) {
            savedTee = await tx.courseTee.update({
              where: { id: existingTee.id },
              data: teeUpdateData as Prisma.CourseTeeUpdateInput,
            });
          } else {
            savedTee = await tx.courseTee.create({
              data: {
                course: { connect: { id } },
                tee_name: tee.tee_name,
                rating: tee.rating ?? null,
                slope: tee.slope ?? null,
              } as Prisma.CourseTeeCreateInput,
            });
          }
        }

        if (tee.deleted !== undefined) {
          await tx.courseHole.updateMany({
            where: { tee_id: savedTee.id },
            data: { deleted_at: tee.deleted ? new Date() : null },
          });
        }

        if (!tee.holes || tee.holes.length === 0) {
          continue;
        }

        for (const hole of tee.holes) {
          const holeUpdateData: Record<string, unknown> = {};

          if (hole.number !== undefined) {
            holeUpdateData.number = hole.number;
          }
          if (hole.yards !== undefined) {
            holeUpdateData.yards = hole.yards;
          }
          if (hole.par !== undefined) {
            holeUpdateData.par = hole.par;
          }
          if (hole.handicap !== undefined) {
            holeUpdateData.handicap = hole.handicap;
          }
          if (hole.deleted !== undefined) {
            holeUpdateData.deleted_at = hole.deleted ? new Date() : null;
          }

          if (hole.id) {
            await tx.courseHole.update({
              where: { id: hole.id },
              data: {
                ...holeUpdateData,
                tee: { connect: { id: savedTee.id } },
              } as Prisma.CourseHoleUpdateInput,
            });
            continue;
          }

          if (hole.number === undefined) {
            throw new BadRequestException(
              'number is required when creating a new hole',
            );
          }

          const existingHole = await tx.courseHole.findFirst({
            where: {
              tee_id: savedTee.id,
              number: hole.number,
              deleted_at: null,
            },
          });

          if (existingHole) {
            await tx.courseHole.update({
              where: { id: existingHole.id },
              data: holeUpdateData as Prisma.CourseHoleUpdateInput,
            });
          } else {
            await tx.courseHole.create({
              data: {
                tee: { connect: { id: savedTee.id } },
                number: hole.number,
                yards: hole.yards ?? 0,
                par: hole.par ?? 0,
                handicap: hole.handicap ?? 0,
              } as Prisma.CourseHoleCreateInput,
            });
          }
        }
      }
    });

    await this.coursesService.invalidateCache();
    return this.coursesService.findOne(id);
  }
}
