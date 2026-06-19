import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, DayType } from '@prisma/client';
import { SearchUsersDto } from './dto/search-users.dto';
import { UserOnboardingDto } from './dto/user-onboarding.dto';
import { CreateUserWithOnboardingDto } from './dto/create-user-with-onboarding.dto';
import { CoursesService } from 'src/courses/courses.service';
import { AugmentedCourseDetails } from 'src/courses/courses.service';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
import { UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';

// Helper function for Haversine distance calculation
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private coursesService: CoursesService,
    private firebaseService: FirebaseService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        auth_id: createUserDto.auth_id,
        admin_status: createUserDto.admin_status,
        email: createUserDto.email,
      },
    });

    await this.prisma.profile.create({
      data: {
        user_id: user.id,
        first_name: createUserDto.first_name,
        last_name: createUserDto.last_name,
      },
    });

    return user;
  }

  findAll() {
    return this.prisma.user.findMany({
      where: { deleted_at: null },
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
      },
    });
  }

  async findAllPaginated(paginateUsersDto?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = paginateUsersDto?.page || 1;
    const limit = paginateUsersDto?.limit || 10;
    const skip = (page - 1) * limit;
    const search = paginateUsersDto?.search;

    // Build where clause with search conditions
    const whereClause: any = { deleted_at: null };

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { first_name: { contains: search, mode: 'insensitive' } } },
        { profile: { last_name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          profile: true,
          latestLocation: true,
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneByAuthId(authId: string) {
    return this.prisma.user.findUnique({
      where: { auth_id: authId, deleted_at: null },
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
        stripe_account: true,
      },
    });
  }

  async findOne(id: string, viewerAuthId?: string) {
    // If viewer provided, block access when either has blocked the other
    if (viewerAuthId) {
      const viewer = await this.prisma.user.findUnique({
        where: { auth_id: viewerAuthId },
      });
      if (!viewer) {
        throw new UnauthorizedException('User not found');
      }
      if (viewer.id !== id) {
        const isBlocked = await this.prisma.block.findFirst({
          where: {
            deleted_at: null,
            blocker_id: id,
            blocked_id: viewer.id,
          },
        });
        if (isBlocked) {
          // Hide existence if blocked
          throw new NotFoundException('User not found');
        }
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id, deleted_at: null },
      include: {
        favourite_courses: {
          include: {
            course: true,
          },
        },
        profile: true,
        latestLocation: true,
        onboarding: {
          include: {
            availability: {
              include: {
                time_slots: true,
              },
            },
          },
        },
        _count: {
          select: {
            created_games: {
              where: {
                deleted_at: null,
              },
            },
            following: {
              where: {
                deleted_at: null,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Count games played (where user is a player, not creator)
    const gamesPlayedCount = await this.prisma.gamePlayer.count({
      where: {
        user_id: id,
        deleted_at: null,
        has_paid: true,
        game: {
          deleted_at: null,
        },
      },
    });

    return {
      ...user,
      stats: {
        gamesPlayed: gamesPlayedCount,
        gamesOrganized: user._count.created_games,
        followers: user._count.following,
      },
    };
  }

  async searchUsers(searchUsersDto: SearchUsersDto, authId: string) {
    const {
      searchTerm,
      lat,
      lng,
      distance,
      handicapRanges,
      playerTypes,
      gamePreferences,
      limit = 50,
    } = searchUsersDto;

    const user = await this.findOneByAuthId(authId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    try {
      const where: Prisma.UserWhereInput = {
        deleted_at: null,
        id: {
          not: user.id,
        },
      };

      if (searchTerm) {
        where.profile = {
          ...(where.profile as Prisma.ProfileWhereInput),
          deleted_at: null,
          OR: [
            { first_name: { contains: searchTerm, mode: 'insensitive' } },
            { last_name: { contains: searchTerm, mode: 'insensitive' } },
          ],
        };
      }

      const onboardingConditions: Prisma.UserOnboardingWhereInput = {};
      let hasOnboardingConditions = false;

      if (playerTypes && playerTypes.length > 0) {
        onboardingConditions.player_type = { in: playerTypes };
        hasOnboardingConditions = true;
      }

      if (gamePreferences && gamePreferences.length > 0) {
        onboardingConditions.preferences = { hasSome: gamePreferences };
        hasOnboardingConditions = true;
      }

      if (handicapRanges && handicapRanges.length > 0) {
        onboardingConditions.handicap_range = { in: handicapRanges };
        hasOnboardingConditions = true;
      }

      if (hasOnboardingConditions) {
        where.onboarding = onboardingConditions;
      }

      if (lat !== undefined && lng !== undefined && distance !== undefined) {
        const numLat = Number(lat);
        const numLng = Number(lng);
        const numDistance = Number(distance);

        const latOffset = numDistance / 111.0;
        const lngOffset =
          numDistance / (111.0 * Math.cos(numLat * (Math.PI / 180.0)));

        where.latestLocation = {
          lat: {
            gte: numLat - latOffset,
            lte: numLat + latOffset,
          },
          lng: {
            gte: numLng - lngOffset,
            lte: numLng + lngOffset,
          },
        };
      }

      // Exclude users blocked by current user or who have blocked current user
      const [iBlock, blockMe] = await Promise.all([
        this.prisma.block.findMany({
          where: { blocker_id: user.id, deleted_at: null },
          select: { blocked_id: true },
        }),
        this.prisma.block.findMany({
          where: { blocked_id: user.id, deleted_at: null },
          select: { blocker_id: true },
        }),
      ]);
      const excludedIds = new Set<string>([
        ...iBlock.map((b) => b.blocked_id),
        ...blockMe.map((b) => b.blocker_id),
      ]);
      if (excludedIds.size > 0) {
        where.id = {
          ...(where.id as any),
          notIn: Array.from(excludedIds),
        } as any;
      }

      const users = await this.prisma.user.findMany({
        where,
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
          latestLocation: true,
        },
        take: Math.min(Math.max(1, Number(limit)), 50),
        orderBy: {
          created_at: 'desc',
        },
      });

      let processedUsers = users.map((u) => ({ ...u, distanceKm: null }));

      if (lat !== undefined && lng !== undefined) {
        const queryLat = Number(lat);
        const queryLng = Number(lng);

        processedUsers = processedUsers.map((user) => {
          if (user.latestLocation) {
            const distKm = haversineDistance(
              queryLat,
              queryLng,
              user.latestLocation.lat,
              user.latestLocation.lng,
            );
            return { ...user, distanceKm: distKm };
          }
          return user; // User has no location, distanceKm remains null
        });

        // If a distance filter was applied, further filter by precise Haversine distance
        if (distance !== undefined) {
          const maxDistance = Number(distance);
          processedUsers = processedUsers.filter(
            (user) =>
              user.distanceKm !== null && user.distanceKm <= maxDistance,
          );
        }

        // Sort by distance if location search was performed
        processedUsers.sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1; // users without distance at the end
          if (b.distanceKm === null) return -1; // users without distance at the end
          return a.distanceKm - b.distanceKm;
        });
      }

      return {
        users: processedUsers,
      };
    } catch (error) {
      console.error('Error in searchUsers:', error);
      throw error;
    }
  }

  async getHomeFeed(authId: string, cursor?: string, limit: number = 10) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { auth_id: authId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentDate = new Date();

      let cursorData;
      if (cursor) {
        try {
          const [type, id, timestamp] = cursor.split('_');
          cursorData = {
            type,
            id,
            timestamp: new Date(timestamp),
          };
        } catch (error) {
          console.error('Invalid cursor format:', error);
          throw new Error('Invalid cursor format');
        }
      }

      const following = await this.prisma.follow.findMany({
        where: {
          follower_id: user.id,
          deleted_at: null,
        },
        select: {
          following_id: true,
        },
      });

      const userGroupIds = await this.prisma.groupMember.findMany({
        where: {
          user_id: user.id,
          deleted_at: null,
        },
        select: {
          group_id: true,
        },
      });

      const userIds = [...following.map((f) => f.following_id), user.id];
      const userGroupIdsList = userGroupIds.map((g) => g.group_id);

      // Determine excluded user IDs based on blocks (either direction)
      const [iBlock, blockMe] = await Promise.all([
        this.prisma.block.findMany({
          where: { blocker_id: user.id, deleted_at: null },
          select: { blocked_id: true },
        }),
        this.prisma.block.findMany({
          where: { blocked_id: user.id, deleted_at: null },
          select: { blocker_id: true },
        }),
      ]);
      const excluded = new Set<string>([
        ...iBlock.map((b) => b.blocked_id),
        ...blockMe.map((b) => b.blocker_id),
      ]);

      const [posts, games] = await Promise.all([
        this.prisma.post.findMany({
          where: {
            user_id: { in: userIds.filter((id) => !excluded.has(id)) },
            deleted_at: null,
            AND: [
              {
                OR: [
                  { group_id: null },
                  {
                    group: {
                      AND: [
                        { deleted_at: null },
                        {
                          OR: [
                            { isPublic: true },
                            { id: { in: userGroupIdsList } },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              ...(cursorData?.type === 'post'
                ? [
                    {
                      OR: [
                        {
                          created_at: { lt: cursorData.timestamp },
                        },
                        {
                          AND: [
                            { created_at: cursorData.timestamp },
                            { id: { lt: cursorData.id } },
                          ],
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            group: true,
            images: true,
            likes: true,
            comments: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            round: {
              include: {
                course: true,
                scores: {
                  include: {
                    user: {
                      include: {
                        profile: true,
                      },
                    },
                  },
                },
              },
            },
          },
          take: limit + 1,
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.game.findMany({
          where: {
            creator_id: { in: userIds.filter((id) => !excluded.has(id)) },
            date: {
              gte: currentDate,
            },
            status: 'PLAYERS_REQUIRED',
            deleted_at: null,
            AND: [
              {
                OR: [
                  { group_id: null },
                  { group_id: { in: userGroupIdsList } },
                ],
              },
              ...(cursorData?.type === 'game'
                ? [
                    {
                      OR: [
                        {
                          created_at: { lt: cursorData.timestamp },
                        },
                        {
                          AND: [
                            { created_at: cursorData.timestamp },
                            { id: { lt: cursorData.id } },
                          ],
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          include: {
            course: true,
            group: true,
            creator: {
              include: {
                profile: true,
              },
            },
            players: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
          },
          take: limit + 1,
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        }),
      ]);

      const items = [
        ...posts.slice(0, limit).map((post) => ({
          id: post.id,
          type: 'post' as const,
          created_at: post.created_at,
          content: post,
        })),
        ...games.slice(0, limit).map((game) => ({
          id: game.id,
          type: 'game' as const,
          created_at: game.created_at,
          content: game,
        })),
      ]
        .sort((a, b) => {
          const dateCompare = b.created_at.getTime() - a.created_at.getTime();
          return dateCompare === 0 ? b.id.localeCompare(a.id) : dateCompare;
        })
        .slice(0, limit);

      const hasMorePosts = posts.length > limit;
      const hasMoreGames = games.length > limit;

      const lastItem = items[items.length - 1];
      const nextCursor =
        lastItem && (hasMorePosts || hasMoreGames)
          ? `${lastItem.type}_${lastItem.id}_${lastItem.created_at.toISOString()}`
          : null;

      return {
        items,
        nextCursor,
      };
    } catch (error) {
      console.error('Error in getHomeFeed:', error);
      throw error;
    }
  }

  findUserGroups(id: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: {
            user_id: id,
            deleted_at: null,
          },
        },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  findUserLeagues(id: string) {
    return this.prisma.leaguePlayer.findMany({
      where: { user_id: id, deleted_at: null },
      include: {
        division: {
          include: {
            league: true,
          },
        },
      },
    });
  }

  findFavouriteCourses(id: string) {
    return this.prisma.favouriteCourse.findMany({
      where: { user_id: id, deleted_at: null },
      include: {
        course: true,
      },
    });
  }

  async findUserFavouriteCoursesDetails(
    userId: string,
  ): Promise<AugmentedCourseDetails[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const favouriteCourseEntries = await this.prisma.favouriteCourse.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      select: {
        course_id: true,
      },
    });

    if (favouriteCourseEntries.length === 0) {
      return [];
    }

    const courseIds = favouriteCourseEntries.map((fav) => fav.course_id);
    return this.coursesService.findDetailedCoursesByIds(courseIds);
  }

  findFollowers(id: string) {
    return this.prisma.follow.findMany({
      where: { following_id: id, deleted_at: null },
      include: {
        follower: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  findFollowing(id: string) {
    return this.prisma.follow.findMany({
      where: { follower_id: id, deleted_at: null },
      include: {
        follower: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  findGames(id: string) {
    try {
      const games = this.prisma.game.findMany({
        where: {
          status: {
            in: ['READY', 'COMPLETED'],
          },
          players: {
            some: {
              user_id: id,
              deleted_at: null,
            },
          },
          deleted_at: null,
        },
        include: {
          course: true,
          players: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      });
      return games;
    } catch (error) {
      console.error('Unable to fetch games', error);
      return [];
    }
  }

  async findOpenGames(authId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return this.prisma.game.findMany({
        where: {
          players: {
            some: {
              user_id: userId,
              deleted_at: null,
            },
          },
          deleted_at: null,
          date: {
            gte: tomorrow,
          },
          status: {
            in: ['PLAYERS_REQUIRED'],
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
        orderBy: {
          date: 'asc',
        },
      });
    } catch (error) {
      console.error('Unable to fetch upcoming games', error);
      return [];
    }
  }

  async getUserFeed(userId: string, cursor?: string, limit: number = 10) {
    try {
      const currentDate = new Date();

      let cursorObj = undefined;
      if (cursor) {
        try {
          const [id, timestamp] = cursor.split('_');
          cursorObj = {
            id_created_at: {
              id,
              created_at: new Date(timestamp),
            },
          };
        } catch (error) {
          console.error('Invalid cursor format:', error);
        }
      }

      const posts = await this.prisma.post.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          AND: [
            {
              OR: [
                { group_id: null },
                {
                  group: {
                    AND: [{ deleted_at: null }, { isPublic: true }],
                  },
                },
              ],
            },
          ],
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          group: true,
          images: true,
          likes: true,
          comments: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
          round: {
            include: {
              course: true,
              scores: {
                include: {
                  user: {
                    include: {
                      profile: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: Math.min(Math.max(1, limit), 50),
        ...(cursorObj && {
          cursor: cursorObj,
          skip: 1,
        }),
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      });

      const games = await this.prisma.game.findMany({
        where: {
          creator_id: userId,
          date: {
            gte: currentDate,
          },
          deleted_at: null,
          status: 'PLAYERS_REQUIRED',
          AND: [
            {
              OR: [
                { group_id: null },
                {
                  group: {
                    AND: [{ deleted_at: null }, { isPublic: true }],
                  },
                },
              ],
            },
          ],
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
        take: Math.min(Math.max(1, limit), 50),
        ...(cursorObj && {
          cursor: cursorObj,
          skip: 1,
        }),
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      });

      const combinedItems = [
        ...posts.map((post) => ({
          id: post.id,
          type: 'post' as const,
          created_at: post.created_at,
          content: post,
        })),
        ...games.map((game) => ({
          id: game.id,
          type: 'game' as const,
          created_at: game.created_at,
          content: game,
        })),
      ].sort((a, b) => {
        const dateCompare = b.created_at.getTime() - a.created_at.getTime();
        return dateCompare === 0 ? b.id.localeCompare(a.id) : dateCompare;
      });

      const nextCursor =
        combinedItems.length >= limit
          ? `${combinedItems[combinedItems.length - 1].id}_${combinedItems[combinedItems.length - 1].created_at.toISOString()}`
          : null;

      return {
        items: combinedItems.slice(0, limit),
        nextCursor,
      };
    } catch (error) {
      console.error('Error in getUserFeed:', error);
      return {
        items: [],
        nextCursor: null,
      };
    }
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async saveOnboardingData(authId: string, onboardingData: UserOnboardingDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      const onboarding = await prisma.userOnboarding.create({
        data: {
          user: { connect: { id: user.id } },
          handicap_range: onboardingData.handicapRange,
          player_type: onboardingData.playerType,
          preferences: onboardingData.preferences,
          onboarding_completed: true,
        },
      });

      const availability = await prisma.userAvailability.create({
        data: {
          onboarding: { connect: { id: onboarding.id } },
        },
      });

      const timeSlotData = [];

      if (
        onboardingData.availability.weekdays &&
        onboardingData.availability.weekdays.length > 0
      ) {
        onboardingData.availability.weekdays.forEach((slot) => {
          timeSlotData.push({
            availability_id: availability.id,
            day_type: 'WEEKDAY' as DayType,
            time_slot: slot,
            weekday_availability: {
              connect: {
                id: availability.id,
              },
            },
          });
        });
      }

      if (
        onboardingData.availability.weekends &&
        onboardingData.availability.weekends.length > 0
      ) {
        onboardingData.availability.weekends.forEach((slot) => {
          timeSlotData.push({
            availability_id: availability.id,
            day_type: 'WEEKEND' as DayType,
            time_slot: slot,
            weekday_availability: {
              connect: {
                id: availability.id,
              },
            },
          });
        });
      }

      if (timeSlotData.length > 0) {
        await prisma.userTimeSlot.createMany({
          data: timeSlotData,
        });
      }

      if (onboardingData.homeCourses && onboardingData.homeCourses.length > 0) {
        await prisma.favouriteCourse.createMany({
          data: onboardingData.homeCourses.map((courseId) => ({
            user_id: user.id,
            course_id: courseId,
          })),
        });
      }

      return onboarding;
    });
  }

  async getOnboardingData(authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const onboarding = await this.prisma.userOnboarding.findUnique({
      where: { user_id: user.id },
      include: {
        availability: {
          include: {
            time_slots: true,
          },
        },
      },
    });

    return onboarding;
  }

  /**
   * Create a new user with onboarding data in a single transaction
   */
  async createWithOnboarding(dto: CreateUserWithOnboardingDto) {
    // Set a longer timeout for this transaction (20 seconds)
    return await this.prisma.$transaction(
      async (prisma) => {
        // 1. Create the user
        const user = await prisma.user.create({
          data: {
            auth_id: dto.auth_id,
            admin_status: dto.admin_status,
            email: dto.email,
          },
        });

        // 2. Create the profile
        await prisma.profile.create({
          data: {
            user_id: user.id,
            first_name: dto.first_name,
            last_name: dto.last_name,
          },
        });

        // 3. Create onboarding record
        const onboarding = await prisma.userOnboarding.create({
          data: {
            user: { connect: { id: user.id } },
            handicap_range: dto.handicapRange,
            player_type: dto.playerType,
            preferences: dto.preferences,
            onboarding_completed: true,
          },
        });

        // 4. Create availability if provided
        if (dto.availability) {
          const availability = await prisma.userAvailability.create({
            data: {
              onboarding: { connect: { id: onboarding.id } },
            },
          });

          const timeSlotData = [];

          // Add weekday slots
          if (
            dto.availability.weekdays &&
            dto.availability.weekdays.length > 0
          ) {
            dto.availability.weekdays.forEach((slot) => {
              timeSlotData.push({
                availability_id: availability.id,
                day_type: 'WEEKDAY' as DayType,
                time_slot: slot,
              });
            });
          }

          // Add weekend slots
          if (
            dto.availability.weekends &&
            dto.availability.weekends.length > 0
          ) {
            dto.availability.weekends.forEach((slot) => {
              timeSlotData.push({
                availability_id: availability.id,
                day_type: 'WEEKEND' as DayType,
                time_slot: slot,
              });
            });
          }

          // Create time slots if any
          if (timeSlotData.length > 0) {
            await prisma.userTimeSlot.createMany({
              data: timeSlotData,
            });
          }
        }

        // 5. Add favorite courses if provided
        if (dto.homeCourses && dto.homeCourses.length > 0) {
          await prisma.favouriteCourse.createMany({
            data: dto.homeCourses.map((courseId) => ({
              user_id: user.id,
              course_id: courseId,
            })),
          });
        }

        // Use findUnique directly on the prisma instance within the transaction
        // instead of calling this.findOne which uses this.prisma outside the transaction
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id, deleted_at: null },
          include: {
            favourite_courses: {
              include: {
                course: true,
              },
            },
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
          },
        });

        return fullUser;
      },
      {
        timeout: 20000, // 20 seconds timeout
      },
    );
  }

  async updateUserLocation(authId: string, data: UpdateUserLocationDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.userLocation.upsert({
      where: { user_id: user.id },
      update: {
        lat: data.lat,
        lng: data.lng,
      },
      create: {
        user_id: user.id,
        lat: data.lat,
        lng: data.lng,
      },
    });
  }

  async deleteAccount(authId: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: authId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Anonymise & soft-delete core user record
      await tx.user.update({
        where: { id: user.id },
        data: {
          auth_id: `deleted_${user.id}`,
          email: null,
          stripe_customer_id: null,
          deleted_at: now,
        },
      });

      // Remove push tokens
      await tx.pushToken.deleteMany({ where: { user_id: user.id } });

      // Scrub profile
      await tx.profile.updateMany({
        where: { user_id: user.id },
        data: {
          first_name: null,
          last_name: null,
          photo: null,
          address_line_1: null,
          address_line_2: null,
          postcode: null,
          city: null,
          mobile_number: null,
          lat: null,
          lng: null,
          handicap: null,
          deleted_at: now,
        },
      });

      // Mark related records as deleted
      await tx.userOnboarding.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });

      await tx.favouriteCourse.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });

      await tx.follow.updateMany({
        where: {
          OR: [{ follower_id: user.id }, { following_id: user.id }],
        },
        data: { deleted_at: now },
      });

      // Remove stored location
      await tx.userLocation.deleteMany({ where: { user_id: user.id } });

      // Soft-delete authored content
      await tx.post.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });
      await tx.image.updateMany({
        where: { post: { user_id: user.id } },
        data: { deleted_at: now },
      });
      await tx.comment.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });
      await tx.like.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });
      await tx.message.updateMany({
        where: { user_id: user.id },
        data: { deleted_at: now },
      });

      // Moderation cleanup
      await tx.block.updateMany({
        where: { OR: [{ blocker_id: user.id }, { blocked_id: user.id }] },
        data: { deleted_at: now },
      });
      await tx.report.updateMany({
        where: {
          OR: [{ reporter_id: user.id }, { target_user_id: user.id }],
        },
        data: { deleted_at: now },
      });
    });

    // Delete Firebase Auth user (ignore if already gone)
    try {
      await this.firebaseService.getAuth().deleteUser(authId);
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    return { message: 'Account deleted successfully' };
  }
}
