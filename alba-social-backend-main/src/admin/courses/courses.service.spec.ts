import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminCoursesService } from './courses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../../courses/courses.service';

describe('AdminCoursesService', () => {
  let service: AdminCoursesService;
  let prismaService: PrismaService;
  let coursesService: CoursesService;

  const mockPrismaService = {
    golfCourse: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCoursesService = {
    invalidateCache: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCoursesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CoursesService,
          useValue: mockCoursesService,
        },
      ],
    }).compile();

    service = module.get<AdminCoursesService>(AdminCoursesService);
    prismaService = module.get<PrismaService>(PrismaService);
    coursesService = module.get<CoursesService>(CoursesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException when course does not exist', async () => {
    mockPrismaService.golfCourse.findUnique.mockResolvedValue(null);

    await expect(
      service.updateCourse('missing-course', { name: 'Updated' }),
    ).rejects.toThrow(new NotFoundException('Course not found'));
  });

  it('should cascade soft delete from course to tees and holes', async () => {
    const courseId = 'course-123';
    mockPrismaService.golfCourse.findUnique.mockResolvedValue({ id: courseId });

    const tx = {
      golfCourse: { update: jest.fn() },
      courseTee: { updateMany: jest.fn() },
      courseHole: { updateMany: jest.fn() },
    };

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      await callback(tx);
    });

    mockCoursesService.findOne.mockResolvedValue({ id: courseId });

    await service.updateCourse(courseId, { deleted: true });

    expect(tx.golfCourse.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: { deleted_at: expect.any(Date) },
    });
    expect(tx.courseTee.updateMany).toHaveBeenCalledWith({
      where: { course_id: courseId },
      data: { deleted_at: expect.any(Date) },
    });
    expect(tx.courseHole.updateMany).toHaveBeenCalledWith({
      where: { tee: { course_id: courseId } },
      data: { deleted_at: expect.any(Date) },
    });
    expect(coursesService.invalidateCache).toHaveBeenCalled();
    expect(coursesService.findOne).toHaveBeenCalledWith(courseId);
  });

  it('should cascade soft delete from tee to holes', async () => {
    const courseId = 'course-123';
    const teeId = 'tee-123';
    mockPrismaService.golfCourse.findUnique.mockResolvedValue({ id: courseId });

    const tx = {
      golfCourse: { update: jest.fn() },
      courseTee: {
        update: jest.fn().mockResolvedValue({ id: teeId }),
        findFirst: jest.fn(),
      },
      courseHole: { updateMany: jest.fn() },
    };

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      await callback(tx);
    });

    mockCoursesService.findOne.mockResolvedValue({ id: courseId });

    await service.updateCourse(courseId, {
      tees: [{ id: teeId, deleted: true }],
    });

    expect(tx.courseTee.update).toHaveBeenCalledWith({
      where: { id: teeId },
      data: { deleted_at: expect.any(Date) },
    });
    expect(tx.courseHole.updateMany).toHaveBeenCalledWith({
      where: { tee_id: teeId },
      data: { deleted_at: expect.any(Date) },
    });
    expect(coursesService.invalidateCache).toHaveBeenCalled();
  });

  it('should throw BadRequestException when creating tee without tee_name', async () => {
    const courseId = 'course-123';
    mockPrismaService.golfCourse.findUnique.mockResolvedValue({ id: courseId });

    const tx = {
      golfCourse: { update: jest.fn() },
      courseTee: { findFirst: jest.fn() },
      courseHole: { updateMany: jest.fn() },
    };

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      await callback(tx);
    });

    await expect(
      service.updateCourse(courseId, { tees: [{}] }),
    ).rejects.toThrow(
      new BadRequestException('tee_name is required when creating a new tee'),
    );
  });

  it('should create a new golf course with minimal fields', async () => {
    const createDto = { name: 'New Course' };
    const expectedCourse = {
      id: 'course-new',
      name: 'New Course',
      lat: null,
      lng: null,
      address: null,
      saturday_9am_cost_pence: null,
      is_bookable: false,
      closed_down: false,
      booking_url: null,
      deleted_at: null,
    };

    mockPrismaService.golfCourse.create.mockResolvedValue(expectedCourse);

    const result = await service.createCourse(createDto);

    expect(mockPrismaService.golfCourse.create).toHaveBeenCalledWith({
      data: {
        name: 'New Course',
        lat: null,
        lng: null,
        address: null,
        saturday_9am_cost_pence: null,
        is_bookable: false,
        closed_down: false,
        booking_url: null,
      },
    });
    expect(mockCoursesService.invalidateCache).toHaveBeenCalled();
    expect(result).toEqual(expectedCourse);
  });

  it('should create a new golf course with all fields', async () => {
    const createDto = {
      name: 'Full Course',
      lat: 52.1234,
      lng: -1.5678,
      address: '123 Golf Lane',
      saturday_9am_cost_pence: 5000,
      is_bookable: true,
      closed_down: false,
      booking_url: 'https://example.com/book',
    };
    const expectedCourse = {
      id: 'course-full',
      ...createDto,
      deleted_at: null,
    };

    mockPrismaService.golfCourse.create.mockResolvedValue(expectedCourse);

    const result = await service.createCourse(createDto);

    expect(mockPrismaService.golfCourse.create).toHaveBeenCalledWith({
      data: createDto,
    });
    expect(mockCoursesService.invalidateCache).toHaveBeenCalled();
    expect(result).toEqual(expectedCourse);
  });
});
