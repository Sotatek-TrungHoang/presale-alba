import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateImageProcessingDto } from './dto/create-image-processing.dto';
import { UpdateImageProcessingDto } from './dto/update-image-processing.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

@Injectable()
export class ImageProcessingService {
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  private isAllowedMediaType(mimeType: string): mimeType is AllowedMediaType {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
      mimeType,
    );
  }

  async create(id: string, createImageProcessingDto: CreateImageProcessingDto) {
    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    if (!this.isAllowedMediaType(createImageProcessingDto.mimeType)) {
      throw new BadRequestException(
        'Unsupported image type. Allowed types are JPEG, PNG, GIF, and WebP.',
      );
    }

    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        temperature: 0,
        system:
          "this is a golf scoresheet. please extract the hole scores and total for each player on there into javascript objects. There will sometimes be a number under 'Out' or 'In' - these can be ignored as these are the totals for either the back or the front 9. if there is an X or a symbol you dont recognise as a number, they should go down as null. There will always be either 9 or 18 holes so ensure you are getting either 9 or 18 scores for each player. if possible please include the total par for the course and how much over or under the total par each players total score was. this should be in the format of {course: {par: int}, playerA: {scores: {[int...]}, total: int, againstPar: int}...}. please include no other text in your response than the javacript in JSON format",
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: createImageProcessingDto.mimeType,
                  data: createImageProcessingDto.file,
                },
              },
            ],
          },
        ],
      });

      const content = msg.content[0];
      return content;
    } catch (error) {
      console.error('Unable to process image: ', error);
      if (error.status === 400) {
        throw new BadRequestException('Invalid image format or content');
      }
      throw error;
    }
  }
}
