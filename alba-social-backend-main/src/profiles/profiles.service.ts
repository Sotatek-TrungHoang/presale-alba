import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DayType, TimeSlot } from '@prisma/client';
import { UserProfileDto, UserProfileResponseDto } from './dto/user-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a complete profile with all related data
   */
  async create(
    createProfileDto: CreateProfileDto,
  ): Promise<UserProfileResponseDto> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createProfileDto.user_id },
    });

    if (!user) {
      throw new NotFoundException(
        `User not found with ID: ${createProfileDto.user_id}`,
      );
    }

    // Use a transaction to ensure all operations succeed or fail together
    return this.prisma.$transaction(
      async (prisma) => {
        // 1. Create or update profile
        const profile = await prisma.profile.upsert({
          where: { user_id: createProfileDto.user_id },
          update: {
            first_name: createProfileDto.first_name,
            last_name: createProfileDto.last_name,
            handicap: createProfileDto.handicap,
            photo: createProfileDto.photo,
            address_line_1: createProfileDto.address_line_1,
            address_line_2: createProfileDto.address_line_2,
            postcode: createProfileDto.postcode,
            city: createProfileDto.city,
            mobile_number: createProfileDto.mobile_number,
            lat: createProfileDto.lat,
            lng: createProfileDto.lng,
            updated_at: new Date(),
          },
          create: {
            user_id: createProfileDto.user_id,
            first_name: createProfileDto.first_name,
            last_name: createProfileDto.last_name,
            handicap: createProfileDto.handicap,
            photo: createProfileDto.photo,
            address_line_1: createProfileDto.address_line_1,
            address_line_2: createProfileDto.address_line_2,
            postcode: createProfileDto.postcode,
            city: createProfileDto.city,
            mobile_number: createProfileDto.mobile_number,
            lat: createProfileDto.lat,
            lng: createProfileDto.lng,
          },
        });

        // 2. Create or update onboarding
        const onboarding = await prisma.userOnboarding.upsert({
          where: { user_id: createProfileDto.user_id },
          update: {
            handicap_range: createProfileDto.handicapRange,
            player_type: createProfileDto.playerType,
            preferences: createProfileDto.preferences,
            onboarding_completed: true,
            updated_at: new Date(),
          },
          create: {
            user_id: createProfileDto.user_id,
            handicap_range:
              createProfileDto.handicapRange ||
              (createProfileDto.handicap
                ? createProfileDto.handicap <= 10
                  ? 'LOW'
                  : createProfileDto.handicap <= 25
                    ? 'MID'
                    : 'HIGH'
                : 'DONT_KNOW'),
            player_type: createProfileDto.playerType || 'CASUAL_PLAYER',
            preferences: createProfileDto.preferences || ['PURELY_SOCIAL'],
            onboarding_completed: true,
          },
        });

        // 3. Handle availability
        if (createProfileDto.availability) {
          const availability = await prisma.userAvailability.upsert({
            where: { onboarding_id: onboarding.id },
            update: {},
            create: {
              onboarding: { connect: { id: onboarding.id } },
            },
          });

          // Delete existing time slots if any
          await prisma.userTimeSlot.deleteMany({
            where: { availability_id: availability.id },
          });

          // Create new time slots
          await this.createTimeSlots(
            prisma,
            availability.id,
            createProfileDto.availability.weekdays || [],
            createProfileDto.availability.weekends || [],
          );
        }

        // 4. Handle home courses
        if (
          createProfileDto.homeCourses &&
          createProfileDto.homeCourses.length > 0
        ) {
          // Delete existing favorites
          await prisma.favouriteCourse.deleteMany({
            where: { user_id: createProfileDto.user_id },
          });

          // Create new favorites
          await prisma.favouriteCourse.createMany({
            data: createProfileDto.homeCourses.map((courseId) => ({
              user_id: createProfileDto.user_id,
              course_id: courseId,
            })),
          });
        }

        // 5. Fetch the updated user with all related data
        const updatedUser = await prisma.user.findUnique({
          where: { id: createProfileDto.user_id },
          include: {
            profile: true,
            onboarding: {
              include: {
                availability: {
                  include: {
                    time_slots: true,
                  },
                },
              },
            },
            favourite_courses: {
              include: {
                course: true,
              },
            },
          },
        });

        return this.mapToUserProfileResponse(updatedUser);
      },
      {
        timeout: 20000, // 20 seconds timeout
      },
    );
  }

  findAll() {
    return `This action returns all profiles`;
  }

  findOne(id: number) {
    return `This action returns a #${id} profile`;
  }

  /**
   * Get a user's complete profile including onboarding data
   */
  async getUserProfile(authId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: {
        profile: true,
        onboarding: {
          include: {
            availability: {
              include: {
                time_slots: true,
              },
            },
          },
        },
        favourite_courses: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${authId}`);
    }

    // Transform to response DTO
    return this.mapToUserProfileResponse(user);
  }

  /**
   * Update a user's profile and onboarding data in a single operation
   */
  async updateUserProfile(
    authId: string,
    profileData: UserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
      include: { profile: true, onboarding: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${authId}`);
    }

    // Use a transaction to ensure all operations succeed or fail together
    return this.prisma.$transaction(
      async (prisma) => {
        // 1. Update profile
        const updatedProfile = await prisma.profile.update({
          where: { user_id: user.id },
          data: {
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            handicap: profileData.handicap,
            photo: profileData.photo,
            address_line_1: profileData.address_line_1,
            address_line_2: profileData.address_line_2,
            postcode: profileData.postcode,
            city: profileData.city,
            mobile_number: profileData.mobile_number,
            lat: profileData.lat,
            lng: profileData.lng,
            updated_at: new Date(),
          },
        });

        // 2. Update or create onboarding
        let onboarding = user.onboarding;
        if (!onboarding) {
          // Create onboarding record if it doesn't exist
          onboarding = await prisma.userOnboarding.create({
            data: {
              user: { connect: { id: user.id } },
              handicap_range:
                profileData.handicapRange ||
                (profileData.handicap
                  ? profileData.handicap <= 10
                    ? 'LOW'
                    : profileData.handicap <= 25
                      ? 'MID'
                      : 'HIGH'
                  : 'DONT_KNOW'),
              player_type: profileData.playerType || 'CASUAL_PLAYER',
              preferences: profileData.preferences || ['PURELY_SOCIAL'],
              onboarding_completed: true,
            },
          });
        } else {
          // Update existing onboarding
          onboarding = await prisma.userOnboarding.update({
            where: { id: onboarding.id },
            data: {
              handicap_range: profileData.handicapRange,
              player_type: profileData.playerType,
              preferences: profileData.preferences,
              onboarding_completed: true,
            },
          });
        }

        // 3. Update availability
        if (profileData.availability) {
          const existingAvailability = await prisma.userAvailability.findUnique(
            {
              where: { onboarding_id: onboarding.id },
              include: {
                time_slots: true,
              },
            },
          );

          const weekdaySlots = profileData.availability.weekdays || [];
          const weekendSlots = profileData.availability.weekends || [];

          if (existingAvailability) {
            // Delete existing time slots
            await prisma.userTimeSlot.deleteMany({
              where: {
                availability_id: existingAvailability.id,
              },
            });

            // Create new time slots
            await this.createTimeSlots(
              prisma,
              existingAvailability.id,
              weekdaySlots,
              weekendSlots,
            );
          } else {
            // Create new availability with time slots
            const newAvailability = await prisma.userAvailability.create({
              data: {
                onboarding: { connect: { id: onboarding.id } },
              },
            });

            await this.createTimeSlots(
              prisma,
              newAvailability.id,
              weekdaySlots,
              weekendSlots,
            );
          }
        }

        // 4. Update home courses if provided
        if (profileData.homeCourses && profileData.homeCourses.length > 0) {
          // First delete existing favorites
          await prisma.favouriteCourse.deleteMany({
            where: { user_id: user.id },
          });

          // Then create new ones
          await prisma.favouriteCourse.createMany({
            data: profileData.homeCourses.map((courseId) => ({
              user_id: user.id,
              course_id: courseId,
            })),
          });
        }

        // 5. Fetch the updated user with all related data
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            profile: true,
            onboarding: {
              include: {
                availability: {
                  include: {
                    time_slots: true,
                  },
                },
              },
            },
            favourite_courses: {
              include: {
                course: true,
              },
            },
          },
        });

        return this.mapToUserProfileResponse(updatedUser);
      },
      {
        timeout: 20000, // 20 seconds timeout
      },
    );
  }

  /**
   * Helper method to create time slots
   */
  private async createTimeSlots(
    prismaOrId: any,
    availabilityId: string,
    weekdaySlots: TimeSlot[],
    weekendSlots: TimeSlot[],
  ) {
    const timeSlotData = [];

    // Deduplicate slots before processing to prevent unique constraint violations
    const uniqueWeekdaySlots = [...new Set(weekdaySlots)];
    const uniqueWeekendSlots = [...new Set(weekendSlots)];

    // Add weekday slots
    uniqueWeekdaySlots.forEach((slot) => {
      timeSlotData.push({
        availability_id: availabilityId,
        day_type: 'WEEKDAY' as DayType,
        time_slot: slot,
      });
    });

    // Add weekend slots
    uniqueWeekendSlots.forEach((slot) => {
      timeSlotData.push({
        availability_id: availabilityId,
        day_type: 'WEEKEND' as DayType,
        time_slot: slot,
      });
    });

    // Create time slots if any
    if (timeSlotData.length > 0) {
      // Check if prismaOrId is a prisma transaction or just an ID
      if (typeof prismaOrId === 'object') {
        await prismaOrId.userTimeSlot.createMany({
          data: timeSlotData,
        });
      } else {
        await this.prisma.userTimeSlot.createMany({
          data: timeSlotData,
        });
      }
    }
  }

  /**
   * Map database user to response DTO
   */
  private mapToUserProfileResponse(user: any): UserProfileResponseDto {
    return {
      id: user.id,
      first_name: user.profile?.first_name,
      last_name: user.profile?.last_name,
      handicap: user.profile?.handicap,
      photo: user.profile?.photo,
      address_line_1: user.profile?.address_line_1,
      address_line_2: user.profile?.address_line_2,
      postcode: user.profile?.postcode,
      city: user.profile?.city,
      country: user.profile?.country,
      mobile_number: user.profile?.mobile_number,
      lat: user.profile?.lat,
      lng: user.profile?.lng,
      handicapRange: user.onboarding?.handicap_range,
      playerType: user.onboarding?.player_type,
      preferences: user.onboarding?.preferences,
      availability: user.onboarding?.availability
        ? {
            weekday_slots: [
              ...new Set(
                user.onboarding.availability.time_slots
                  ?.filter((slot) => slot.day_type === 'WEEKDAY')
                  ?.map((slot) => slot.time_slot) || [],
              ),
            ],
            weekend_slots: [
              ...new Set(
                user.onboarding.availability.time_slots
                  ?.filter((slot) => slot.day_type === 'WEEKEND')
                  ?.map((slot) => slot.time_slot) || [],
              ),
            ],
          }
        : undefined,
      homeCourses: user.favourite_courses?.map((fc) => ({
        id: fc.course.id,
        name: fc.course.name,
      })),
      onboardingCompleted: user.onboarding?.onboarding_completed || false,
    };
  }

  remove(id: number) {
    return `This action removes a #${id} profile`;
  }
}
