import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { GoogleMapsService } from 'src/shared/services/google-maps.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, GoogleMapsService],
})
export class LocationsModule {}
