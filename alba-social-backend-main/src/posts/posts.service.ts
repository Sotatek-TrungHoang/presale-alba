import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindPostsDto } from './dto/find-posts.dto';
import { LikePostDto } from './dto/like-posts.dto';
import { AddCommentDto } from './dto/add-comment.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async createPost(id: string, createPostDto: CreatePostDto) {
    const { content, type, roundData, groupId, imageUrls } = createPostDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    return this.prisma.post.create({
      data: {
        content,
        user_id: user.id,
        group_id: groupId,
        type,
        images: {
          create:
            imageUrls?.map((url) => ({
              url,
            })) || [],
        },
        round:
          type === 'SCORE' && roundData
            ? {
                create: {
                  course_id: roundData.courseId,
                  tee_id: roundData.teeId,
                  date: roundData.date,
                  scores: {
                    create: roundData.players
                      .filter(
                        (player: any) =>
                          !player.userId.startsWith('unassigned-'),
                      )
                      .map((player: any) => ({
                        user_id: player.userId,
                        scores: player.scores,
                        total: player.total,
                        againstPar: player.againstPar,
                      })),
                  },
                  unassigned_scores: {
                    create: roundData.players
                      .filter((player: any) =>
                        player.userId.startsWith('unassigned-'),
                      )
                      .map((player: any) => ({
                        scores: player.scores,
                        total: player.total,
                        againstPar: player.againstPar,
                      })),
                  },
                },
              }
            : undefined,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        images: true,
        round: {
          include: {
            course: true,
            tee: true,
            scores: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            unassigned_scores: {
              where: {
                deleted_at: null,
              },
            },
          },
        },
      },
    });
  }

  async findPosts(getPostsDto: FindPostsDto) {
    const { groupId, courseId, userId, cursor, limit = 10 } = getPostsDto;

    const whereClause: any = { deleted_at: null };

    if (groupId) {
      whereClause.group_id = groupId;
    }

    if (courseId) {
      whereClause.round = {
        course_id: courseId,
      };
    }

    if (userId) {
      whereClause.user_id = userId;
    }

    const posts = await this.prisma.post.findMany({
      where: whereClause,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        images: {
          where: {
            deleted_at: null,
          },
        },
        round: {
          include: {
            course: true,
            tee: true,
            scores: {
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
            unassigned_scores: {
              where: {
                deleted_at: null,
              },
            },
          },
        },
        likes: {
          where: {
            deleted_at: null,
          },
        },
        comments: {
          where: { deleted_at: null },
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

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1].id : null;

    return {
      posts,
      nextCursor,
    };
  }

  async likePost(id: string, likePostDto: LikePostDto) {
    const { postId } = likePostDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    await this.prisma.like.upsert({
      where: {
        user_id_post_id: {
          user_id: user.id,
          post_id: postId,
        },
      },
      update: {
        deleted_at: null,
      },
      create: {
        user_id: user.id,
        post_id: postId,
      },
    });
    return { message: 'Post liked successfully' };
  }

  async unlikePost(id: string, likePostDto: LikePostDto) {
    const { postId } = likePostDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    await this.prisma.like.update({
      where: {
        user_id_post_id: {
          user_id: user.id,
          post_id: postId,
        },
      },
      data: {
        deleted_at: new Date(),
      },
    });
    return { message: 'Post unliked successfully' };
  }

  async addComment(id: string, addCommentDto: AddCommentDto) {
    const { postId, content } = addCommentDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    // Check if the post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        content,
        user_id: user.id,
        post_id: postId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    return comment;
  }

  update(id: number, updatePostDto: UpdatePostDto) {
    return `This action updates a #${id} post`;
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }
}
