import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastqService } from './services';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly fastqService: FastqService,
    private readonly configService: ConfigService,
  ) {}

  

  getHello(): string {
    return 'Hello World!';
  }
}
