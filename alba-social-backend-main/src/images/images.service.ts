import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetPresignedUrlDto } from './dto/get-presigned.dto';
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

@Injectable()
export class ImagesService {
  private s3: S3Client;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async getPresignedUrl(id: string, getPresignedUrlDto: GetPresignedUrlDto) {
    const { fileName, fileType } = getPresignedUrlDto;

    const user = await this.prisma.user.findUnique({
      where: { auth_id: id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found for auth_id: ${id}`);
    }

    const bucketName = this.configService.get('AWS_S3_BUCKET_NAME');
    const objectKey = `profileImage/${Date.now()}-${fileName}`;

    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: bucketName,
      Key: objectKey,
      Conditions: [
        ['content-length-range', 0, 10485760], // up to 10 MB
        ['starts-with', '$Content-Type', fileType],
      ],
      Fields: {
        'Content-Type': fileType,
      },
      Expires: 600, // URL expires in 10 minutes
    });

    return {
      url,
      fields,
      bucketName,
      region: this.configService.get('AWS_REGION'),
      objectKey,
    };
  }
}
