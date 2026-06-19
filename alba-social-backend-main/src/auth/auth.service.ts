import { Injectable } from '@nestjs/common';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async signup(firebaseUser: any, first_name: string, last_name: string) {
    const createUserDto: CreateUserDto = {
      auth_id: firebaseUser.uid,
      email: firebaseUser.email,
      admin_status: false,
      first_name: first_name,
      last_name: last_name,
    };

    const user = await this.usersService.create(createUserDto);
    return user;
  }
}
