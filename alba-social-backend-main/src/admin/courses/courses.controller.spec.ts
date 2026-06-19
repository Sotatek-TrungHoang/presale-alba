import { Test, TestingModule } from '@nestjs/testing';
import { AdminCoursesController } from './courses.controller';
import { CoursesService } from '../../courses/courses.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { FirebaseService } from '../../firebase/firebase.service';
import { AdminCoursesService } from './courses.service';

describe('AdminCoursesController', () => {
  let controller: AdminCoursesController;
  let coursesService: CoursesService;
  let adminCoursesService: AdminCoursesService;

  const mockCoursesService = {
    findAllPaginated: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAdminCoursesService = {
    createCourse: jest.fn(),
    updateCourse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: mockCoursesService,
        },
        {
          provide: AdminCoursesService,
          useValue: mockAdminCoursesService,
        },
        {
          provide: FirebaseService,
          useValue: {
            verifyIdToken: jest
              .fn()
              .mockResolvedValue({ uid: 'test-admin-auth-id' }),
          },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: jest.fn().mockImplementation(() => true),
      })
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate: jest.fn().mockImplementation(() => true),
      })
      .compile();

    controller = module.get<AdminCoursesController>(AdminCoursesController);
    coursesService = module.get<CoursesService>(CoursesService);
    adminCoursesService = module.get<AdminCoursesService>(AdminCoursesService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllPaginated', () => {
    it('should call coursesService.findAllPaginated with provided parameters', async () => {
      // Arrange
      const paginateDto = { page: 2, limit: 20 };
      const expectedResult = {
        courses: [],
        pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
      };
      mockCoursesService.findAllPaginated.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllPaginated(paginateDto);

      // Assert
      expect(mockCoursesService.findAllPaginated).toHaveBeenCalledWith(
        paginateDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should call coursesService.findAllPaginated with search parameter', async () => {
      // Arrange
      const paginateDto = { page: 1, limit: 20, search: 'royal' };
      const expectedResult = {
        courses: [
          { id: '1', name: 'Royal Troon Golf Club', address: 'Scotland' },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockCoursesService.findAllPaginated.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllPaginated(paginateDto);

      // Assert
      expect(mockCoursesService.findAllPaginated).toHaveBeenCalledWith(
        paginateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should call coursesService.findOne with provided course id', async () => {
      // Arrange
      const courseId = 'course-123';
      const expectedResult = {
        id: courseId,
        name: 'Test Golf Course',
        lat: 51.5,
        lng: -0.1,
        address: '123 Golf Rd',
      };
      mockCoursesService.findOne.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findOne(courseId);

      // Assert
      expect(mockCoursesService.findOne).toHaveBeenCalledWith(courseId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create', () => {
    it('should call adminCoursesService.createCourse with provided payload', async () => {
      const createDto = {
        name: 'New Golf Course',
        lat: 51.5,
        lng: -0.1,
        address: '123 Golf Rd',
        is_bookable: true,
      };
      const expectedResult = { id: 'course-123', ...createDto };
      mockAdminCoursesService.createCourse.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(mockAdminCoursesService.createCourse).toHaveBeenCalledWith(
        createDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should create course with minimal fields', async () => {
      const createDto = { name: 'Minimal Course' };
      const expectedResult = { id: 'course-456', ...createDto };
      mockAdminCoursesService.createCourse.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(mockAdminCoursesService.createCourse).toHaveBeenCalledWith(
        createDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should call adminCoursesService.updateCourse with provided course id and payload', async () => {
      const courseId = 'course-123';
      const updateDto = {
        name: 'Updated Course',
        tees: [{ id: 'tee-1', tee_name: 'Blue', deleted: false }],
      };
      const expectedResult = { id: courseId, name: 'Updated Course' };
      mockAdminCoursesService.updateCourse.mockResolvedValue(expectedResult);

      const result = await controller.update(courseId, updateDto);

      expect(mockAdminCoursesService.updateCourse).toHaveBeenCalledWith(
        courseId,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
