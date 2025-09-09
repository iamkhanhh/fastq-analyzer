import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FastqService {
    private readonly logger = new Logger(FastqService.name);
}
