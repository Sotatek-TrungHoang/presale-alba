import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const wellKnownDir = join(__dirname, '..', '..', 'public', '.well-known');

@Controller()
export class WellKnownController {
  private readonly aasa = JSON.parse(
    readFileSync(join(wellKnownDir, 'apple-app-site-association'), 'utf8'),
  );

  private readonly assetLinks = JSON.parse(
    readFileSync(join(wellKnownDir, 'assetlinks.json'), 'utf8'),
  );

  @Get(['.well-known/apple-app-site-association', 'apple-app-site-association'])
  @Header('Content-Type', 'application/json')
  getAppleAppSiteAssociation() {
    return this.aasa;
  }

  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  getAssetLinks() {
    return this.assetLinks;
  }
}
