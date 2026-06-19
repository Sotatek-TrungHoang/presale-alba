import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchCoursesDto } from './dto/search-courses.dto';
import { GoogleMapsService } from 'src/shared/services/google-maps.service';
import { SearchCoursesLocationsDto } from './dto/search-courses-locations.dto';
import { SearchResult } from 'src/shared/interfaces/search-result.interface';
import { PaginatedResponse } from 'src/shared/interfaces/paginated-response.interface';
import { PaginateCoursesDto } from './dto/pagination-courses.dto';
import {
  GolfCourse,
  Prisma,
  CourseTee,
  CourseHole,
  CoursePriceThreshold,
} from '@prisma/client';
import { AddReviewDto } from './dto/add-review.dto';
import { AddConditionReportDto } from './dto/add-condition-report.dto';
import { FindCoursesByLocationDto } from './dto/find-courses-by-location.dto';
import { ToggleFavouriteCourseDto } from './dto/toggle-favourite-course.dto';
import path, { join } from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// Define interfaces for augmented course data structures
export interface AugmentedCourseDetails extends GolfCourse {
  price_rating?: number;
  num_holes?: number;
  course_par?: number;
  course_slope?: number | null;
}

export interface AugmentedCourseForLocation extends GolfCourse {
  lat: number; // Specific to location-based search where lat/lng are asserted
  lng: number;
  distance: number;
  price_rating?: number;
  num_holes?: number;
  course_par?: number;
  course_slope?: number | null;
}

export interface AugmentedCourseWithDetails extends AugmentedCourseDetails {
  reviews?: any[];
  condition_reports?: any[];
  favourites?: any[];
  games?: any[];
}

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private googleMapsService: GoogleMapsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async _augmentCourseWithDetails(
    courseWithTees: Prisma.GolfCourseGetPayload<{
      include: {
        tees: {
          include: {
            holes: true;
          };
        };
      };
    }>,
    priceThresholds: CoursePriceThreshold[],
  ): Promise<AugmentedCourseDetails> {
    let price_rating: number | undefined = undefined;
    if (
      courseWithTees.saturday_9am_cost_pence !== null &&
      courseWithTees.saturday_9am_cost_pence !== undefined
    ) {
      const matchedThreshold = priceThresholds.find(
        (threshold) =>
          (courseWithTees.saturday_9am_cost_pence ?? 0) >=
            threshold.lower_bound &&
          (courseWithTees.saturday_9am_cost_pence ?? Infinity) <=
            threshold.upper_bound,
      );
      if (matchedThreshold) {
        price_rating = matchedThreshold.rating;
      }
    }

    let num_holes: number | undefined = undefined;
    let course_par: number | undefined = undefined;
    let course_slope: number | null | undefined = undefined;

    if (courseWithTees.tees && courseWithTees.tees.length > 0) {
      let representativeTee: (typeof courseWithTees.tees)[0] | null = null;
      const eighteenHoleTees = courseWithTees.tees.filter(
        (tee) => tee.holes.length === 18,
      );

      if (eighteenHoleTees.length > 0) {
        representativeTee = eighteenHoleTees[0];
      } else if (courseWithTees.tees.length > 0) {
        representativeTee = courseWithTees.tees.reduce((prev, current) =>
          prev.holes.length > current.holes.length ? prev : current,
        );
      }

      if (representativeTee && representativeTee.holes.length > 0) {
        num_holes = representativeTee.holes.length;
        course_par = representativeTee.holes.reduce(
          (sum, hole) => sum + hole.par,
          0,
        );
        course_slope = representativeTee.slope;
      }
    }

    return {
      ...courseWithTees,
      price_rating,
      num_holes,
      course_par,
      course_slope,
    } as AugmentedCourseDetails;
  }

  async findDetailedCoursesByIds(
    courseIds: string[],
  ): Promise<AugmentedCourseDetails[]> {
    if (!courseIds || courseIds.length === 0) {
      return [];
    }

    const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
      where: { locale: 'GB', deleted_at: null },
      orderBy: { lower_bound: 'asc' },
    });

    const coursesWithRelations = await this.prisma.golfCourse.findMany({
      where: {
        id: { in: courseIds },
        deleted_at: null,
        is_bookable: true,
        closed_down: false,
      },
      include: {
        tees: {
          where: { deleted_at: null },
          include: {
            holes: {
              where: { deleted_at: null },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { tee_name: 'desc' },
        },
      },
    });

    const augmentedCourses = await Promise.all(
      coursesWithRelations.map((course) =>
        this._augmentCourseWithDetails(
          course as Prisma.GolfCourseGetPayload<{
            include: { tees: { include: { holes: true } } };
          }>,
          priceThresholds,
        ),
      ),
    );
    return augmentedCourses;
  }

  create(createCourseDto: CreateCourseDto) {
    return 'This action adds a new course';
  }

  async findAll(): Promise<AugmentedCourseDetails[]> {
    const cacheKey = 'courses:all';

    // Try to get from cache first
    const cached =
      await this.cacheManager.get<AugmentedCourseDetails[]>(cacheKey);
    if (cached) {
      console.log('Returning cached courses');
      return cached;
    }

    console.log('Cache miss - fetching from database');

    try {
      const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
        where: { locale: 'GB', deleted_at: null },
        orderBy: { lower_bound: 'asc' },
      });

      const coursesFromDb = await this.prisma.golfCourse.findMany({
        where: {
          deleted_at: null,
          is_bookable: true,
          closed_down: false,
        },
        include: {
          tees: {
            where: { deleted_at: null },
            include: {
              holes: {
                where: { deleted_at: null },
                orderBy: { number: 'asc' },
              },
            },
            orderBy: { tee_name: 'desc' },
          },
        },
      });

      const courses = await Promise.all(
        coursesFromDb.map((course) =>
          this._augmentCourseWithDetails(
            course as Prisma.GolfCourseGetPayload<{
              include: { tees: { include: { holes: true } } };
            }>,
            priceThresholds,
          ),
        ),
      );

      // Cache indefinitely (no TTL)
      await this.cacheManager.set(cacheKey, courses);
      console.log('Courses cached successfully');

      return courses;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async findAllPaginated(
    paginateCoursesDto: PaginateCoursesDto,
  ): Promise<PaginatedResponse<AugmentedCourseDetails>> {
    const page = paginateCoursesDto.page || 1;
    const limit = paginateCoursesDto.limit || 20;
    const skip = (page - 1) * limit;
    const search = paginateCoursesDto.search;

    try {
      const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
        where: { locale: 'GB', deleted_at: null },
        orderBy: { lower_bound: 'asc' },
      });

      // Build where clause with search conditions
      const whereClause: any = {
        deleted_at: null,
        is_bookable: true,
        closed_down: false,
      };

      if (search) {
        whereClause.name = { contains: search, mode: 'insensitive' };
      }

      // Get total count
      const total = await this.prisma.golfCourse.count({
        where: whereClause,
      });

      // Get paginated courses
      const coursesFromDb = await this.prisma.golfCourse.findMany({
        where: whereClause,
        skip,
        take: limit,
      });

      const courses = await Promise.all(
        coursesFromDb.map((course) =>
          this._augmentCourseWithDetails(
            course as Prisma.GolfCourseGetPayload<{
              include: { tees: { include: { holes: true } } };
            }>,
            priceThresholds,
          ),
        ),
      );

      const totalPages = Math.ceil(total / limit);

      return {
        data: courses,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Failed to fetch paginated courses',
      );
    }
  }

  async searchCourses(
    searchCoursesDto: SearchCoursesDto,
  ): Promise<AugmentedCourseDetails[]> {
    const { searchTerm } = searchCoursesDto;

    const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
      where: { locale: 'GB', deleted_at: null },
      orderBy: { lower_bound: 'asc' },
    });

    const coursesFromDb = await this.prisma.golfCourse.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ],
        deleted_at: null,
        is_bookable: true,
        closed_down: false,
      },
      include: {
        tees: {
          where: { deleted_at: null },
          include: {
            holes: {
              where: { deleted_at: null },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { tee_name: 'desc' },
        },
      },
      take: 5,
    });

    const augmentedCourses = await Promise.all(
      coursesFromDb.map((course) =>
        this._augmentCourseWithDetails(
          course as Prisma.GolfCourseGetPayload<{
            include: { tees: { include: { holes: true } } };
          }>,
          priceThresholds,
        ),
      ),
    );

    return augmentedCourses;
  }

  async searchCoursesAndLocations(
    searchCoursesLocationsDto: SearchCoursesLocationsDto,
  ): Promise<SearchResult> {
    const { searchTerm } = searchCoursesLocationsDto;

    const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
      where: { locale: 'GB', deleted_at: null },
      orderBy: { lower_bound: 'asc' },
    });

    const coursesFromDb = await this.prisma.golfCourse.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ],
        deleted_at: null,
        is_bookable: true,
        closed_down: false,
      },
      include: {
        tees: {
          where: { deleted_at: null },
          include: {
            holes: { where: { deleted_at: null }, orderBy: { number: 'asc' } },
          },
          orderBy: { tee_name: 'desc' },
        },
      },
    });

    const courses = await Promise.all(
      coursesFromDb.map((course) =>
        this._augmentCourseWithDetails(
          course as Prisma.GolfCourseGetPayload<{
            include: { tees: { include: { holes: true } } };
          }>,
          priceThresholds,
        ),
      ),
    );

    const locations = await this.googleMapsService.searchLocations(searchTerm);

    return { courses, locations };
  }

  async findOne(id: string): Promise<AugmentedCourseWithDetails | null> {
    try {
      const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
        where: { locale: 'GB', deleted_at: null },
        orderBy: { lower_bound: 'asc' },
      });

      const course = await this.prisma.golfCourse.findUnique({
        where: {
          id,
          deleted_at: null,
        },
        include: {
          tees: {
            where: { deleted_at: null },
            include: {
              holes: {
                where: { deleted_at: null },
                orderBy: { number: 'asc' },
              },
            },
            orderBy: { tee_name: 'desc' },
          },
          reviews: {
            where: { deleted_at: null },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
            orderBy: { created_at: 'desc' },
          },
          condition_reports: {
            where: { deleted_at: null },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
            orderBy: { created_at: 'desc' },
          },
          favourites: {
            where: {
              deleted_at: null,
            },
            include: {
              user: {
                include: {
                  profile: {
                    where: { deleted_at: null },
                  },
                  onboarding: true,
                },
              },
            },
          },
        },
      });

      if (!course) {
        return null;
      }

      // Get games in PLAYERS_REQUIRED status with date today or earlier
      const games = await this.prisma.game.findMany({
        where: {
          course_id: id,
          deleted_at: null,
          status: 'PLAYERS_REQUIRED',
          date: {
            gte: new Date(),
          },
        },
        include: {
          creator: {
            include: {
              profile: true,
            },
          },
          players: {
            where: {
              deleted_at: null,
            },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });

      // Augment the course with details
      const augmentedCourse = await this._augmentCourseWithDetails(
        course as Prisma.GolfCourseGetPayload<{
          include: { tees: { include: { holes: true } } };
        }>,
        priceThresholds,
      );

      return {
        ...augmentedCourse,
        reviews: course.reviews,
        condition_reports: course.condition_reports,
        favourites: course.favourites,
        games: games,
      } as AugmentedCourseWithDetails;
    } catch (error) {
      console.error('Failed to fetch course:', error);
      return null;
    }
  }

  async findGames(id: string) {
    try {
      const games = await this.prisma.game.findMany({
        where: {
          course_id: id,
          deleted_at: null,
          status: 'PLAYERS_REQUIRED',
          date: {
            gte: new Date(),
          },
        },
        include: {
          course: true,
          creator: {
            include: {
              profile: true,
            },
          },
          players: {
            where: {
              deleted_at: null,
            },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });
      return games;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async findTees(id: string) {
    try {
      const courseTees = await this.prisma.courseTee.findMany({
        where: {
          course_id: id,
          deleted_at: null,
        },
        include: {
          holes: {
            where: {
              deleted_at: null,
            },
            orderBy: {
              number: 'asc',
            },
          },
        },
      });

      // Transform the data into a more frontend-friendly format
      return courseTees.map((tee) => ({
        id: tee.id,
        name: tee.tee_name,
        rating: tee.rating,
        slope: tee.slope,
        holes: tee.holes.map((hole) => ({
          number: hole.number,
          yards: hole.yards,
          par: hole.par,
          handicap: hole.handicap,
        })),
      }));
    } catch (error) {
      console.error('Failed to fetch course tees:', error);
      return [];
    }
  }

  async findCoursesByLocation(
    findCoursesByLocationDto: FindCoursesByLocationDto,
  ): Promise<AugmentedCourseForLocation[]> {
    const { lng, lat, radius } = findCoursesByLocationDto;
    const radiusInDegrees = radius / 111;

    const priceThresholds = await this.prisma.coursePriceThreshold.findMany({
      where: { locale: 'GB', deleted_at: null },
      orderBy: { lower_bound: 'asc' },
    });

    const coursesFromDb = await this.prisma.golfCourse.findMany({
      where: {
        lat: { gte: lat - radiusInDegrees, lte: lat + radiusInDegrees },
        lng: { gte: lng - radiusInDegrees, lte: lng + radiusInDegrees },
        deleted_at: null,
        is_bookable: true,
        closed_down: false,
      },
      include: {
        tees: {
          where: { deleted_at: null },
          include: {
            holes: { where: { deleted_at: null }, orderBy: { number: 'asc' } },
          },
          orderBy: { tee_name: 'desc' },
        },
      },
    });

    const coursesWithAugmentedDetails = await Promise.all(
      coursesFromDb.map((course) =>
        this._augmentCourseWithDetails(
          course as Prisma.GolfCourseGetPayload<{
            include: { tees: { include: { holes: true } } };
          }>,
          priceThresholds,
        ),
      ),
    );

    const coursesWithDistanceAndLocation = coursesWithAugmentedDetails
      .map((augmentedCourse) => {
        if (augmentedCourse.lat && augmentedCourse.lng) {
          const distance = this.calculateDistance(
            lat,
            lng,
            augmentedCourse.lat,
            augmentedCourse.lng,
          );
          return {
            ...augmentedCourse,
            lat: augmentedCourse.lat,
            lng: augmentedCourse.lng,
            distance,
          } as AugmentedCourseForLocation;
        }
        return null;
      })
      .filter(
        (course): course is AugmentedCourseForLocation =>
          course !== null && course.distance <= radius,
      );

    coursesWithDistanceAndLocation.sort((a, b) => a.distance - b.distance);
    return coursesWithDistanceAndLocation;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async addReview(id: string, addReviewDto: AddReviewDto) {
    const { courseId, comment } = addReviewDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    // Check if the course exists
    const course = await this.prisma.golfCourse.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.courseReview.create({
      data: {
        comment,
        user_id: user.id,
        course_id: courseId,
      },
    });
  }

  async addConditionReport(
    id: string,
    addConditionReportDto: AddConditionReportDto,
  ) {
    const { courseId, condition, details } = addConditionReportDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    // Check if the course exists
    const course = await this.prisma.golfCourse.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!courseId || !condition) {
      throw new BadRequestException('Missing required fields');
    }

    return this.prisma.courseCondition.create({
      data: {
        course_id: courseId,
        condition: condition,
        details: details,
        reporter: user.id,
      },
    });
  }

  async toggleFavouriteCourse(
    id: string,
    toggleFavouriteCourseDto: ToggleFavouriteCourseDto,
  ): Promise<boolean> {
    const { courseId } = toggleFavouriteCourseDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    // Check if the course exists
    const course = await this.prisma.golfCourse.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingFavourite = await this.prisma.favouriteCourse.findUnique({
      where: {
        user_id_course_id: {
          user_id: user.id,
          course_id: courseId,
        },
      },
    });

    if (existingFavourite && existingFavourite.deleted_at === null) {
      // If the course is already favourited, remove it
      await this.prisma.favouriteCourse.update({
        where: {
          id: existingFavourite.id,
        },
        data: {
          updated_at: new Date(),
          deleted_at: new Date(),
        },
      });
      return false; // Course is no longer favourited
    } else if (existingFavourite && existingFavourite.deleted_at) {
      // course already favourited but previously removed
      await this.prisma.favouriteCourse.update({
        where: {
          id: existingFavourite.id,
        },
        data: {
          updated_at: new Date(),
          deleted_at: null,
        },
      });
      return true; // Course is favourited
    } else {
      // If the course is not favourited, add it
      await this.prisma.favouriteCourse.create({
        data: {
          user_id: user.id,
          course_id: courseId,
        },
      });
      return true; // Course is now favourited
    }
  }

  async exportToCsv(): Promise<string> {
    try {
      // Fetch all courses
      const courses = await this.fetchGolfCourses();

      // Generate file path in the temp directory
      const timestamp = Date.now();
      const filePath = join(process.cwd(), `golf_courses_${timestamp}.csv`);

      // Create and write CSV
      await this.writeCsvFile(filePath, courses);

      return filePath;
    } catch (error) {
      console.error('Error in exportToCsv:', error);
      throw new InternalServerErrorException('Failed to export CSV');
    }
  }

  private async fetchGolfCourses(): Promise<GolfCourse[]> {
    return this.prisma.golfCourse.findMany({
      where: {
        deleted_at: null,
      },
    });
  }

  private async writeCsvFile(
    filePath: string,
    data: GolfCourse[],
  ): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'id' },
        { id: 'name', title: 'name' },
        { id: 'lat', title: 'lat' },
        { id: 'lng', title: 'lng' },
        { id: 'address', title: 'address' },
        // Add other fields as needed
      ],
    });

    await csvWriter.writeRecords(data);
  }

  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }

  update(id: number, updateCourseDto: UpdateCourseDto) {
    return `This action updates a #${id} course`;
  }

  remove(id: number) {
    return `This action removes a #${id} course`;
  }

  // Method to manually invalidate cache when courses are updated
  async invalidateCache(): Promise<void> {
    await this.cacheManager.del('courses:all');
    console.log('Courses cache invalidated');
  }
}
