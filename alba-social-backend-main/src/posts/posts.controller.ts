import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FindPostsDto } from './dto/find-posts.dto';
import { LikePostDto } from './dto/like-posts.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { FirebaseAuthGuard } from 'src/guards/firebase-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post()
  async createPost(@Request() req, @Body() createPostDto: CreatePostDto) {
    return this.postsService.createPost(req.user.uid, createPostDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('like')
  async likePost(@Request() req, @Body() likePostDto: LikePostDto) {
    return this.postsService.likePost(req.user.uid, likePostDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('comment')
  async addComment(@Request() req, @Body() addCommentDto: AddCommentDto) {
    return this.postsService.addComment(req.user.uid, addCommentDto);
  }

  @Get()
  async findPosts(@Query() getPostsDto: FindPostsDto) {
    return this.postsService.findPosts(getPostsDto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Delete('unlike')
  async unlikePost(@Request() req, @Body() likePostDto: LikePostDto) {
    return this.postsService.unlikePost(req.user.uid, likePostDto);
  }
}
