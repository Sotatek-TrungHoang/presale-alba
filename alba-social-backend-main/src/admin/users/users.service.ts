import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUser(id: string, updateUserAdminDto: UpdateUserAdminDto) {
    try {
      // Prepare data for User update
      const userData: any = {};
      if (updateUserAdminDto.admin_status !== undefined) {
        userData.admin_status = updateUserAdminDto.admin_status;
      }
      if (updateUserAdminDto.email !== undefined) {
        userData.email = updateUserAdminDto.email;
      }

      // Prepare data for Profile update
      const profileData: any = {};
      if (updateUserAdminDto.first_name !== undefined) {
        profileData.first_name = updateUserAdminDto.first_name;
      }
      if (updateUserAdminDto.last_name !== undefined) {
        profileData.last_name = updateUserAdminDto.last_name;
      }
      if (updateUserAdminDto.address !== undefined) {
        profileData.address = updateUserAdminDto.address;
      }
      if (updateUserAdminDto.handicap !== undefined) {
        profileData.handicap = updateUserAdminDto.handicap;
      }

      // Update user and profile in a transaction
      const updatedUser = await this.prisma.user.update({
        where: { id, deleted_at: null },
        data: {
          ...userData,
          ...(Object.keys(profileData).length > 0 && {
            profile: {
              update: profileData,
            },
          }),
          updated_at: new Date(),
        },
        include: {
          profile: true,
        },
      });

      return updatedUser;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with id ${id} not found`);
      }
      throw error;
    }
  }
}
