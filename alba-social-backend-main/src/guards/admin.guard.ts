import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * AdminGuard checks if the authenticated user has admin privileges
 * Must be used with FirebaseAuthGuard for authentication first
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user from database to check admin_status
    const dbUser = await this.prisma.user.findUnique({
      where: { auth_id: user.uid },
      select: { admin_status: true, id: true },
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found');
    }

    if (!dbUser.admin_status) {
      throw new ForbiddenException(
        'Only administrators can access this resource',
      );
    }

    // Attach user info to request for use in controllers/services
    request.user.isAdmin = true;
    request.user.userId = dbUser.id;

    return true;
  }
}
