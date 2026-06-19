import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import { PrismaService } from 'src/prisma/prisma.service';

const ACTIVITY_DEBOUNCE_MS = 60 * 60 * 1000;

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private firebaseService: FirebaseService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decodedToken = await this.firebaseService
        .getAuth()
        .verifyIdToken(token);
      request['user'] = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      };
      this.bumpLastActiveAt(decodedToken.uid);
      return true;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private bumpLastActiveAt(authId: string): void {
    const cutoff = new Date(Date.now() - ACTIVITY_DEBOUNCE_MS);
    this.prisma.user
      .updateMany({
        where: {
          auth_id: authId,
          deleted_at: null,
          OR: [{ last_active_at: null }, { last_active_at: { lt: cutoff } }],
        },
        data: { last_active_at: new Date() },
      })
      .catch((err) =>
        console.error('Failed to update last_active_at:', err),
      );
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
