import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FastqService } from './services/fastq.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { GlobalService } from './services/global.service';
import { CommunicationService } from './services/communication.service';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    HttpModule
  ],
  controllers: [AppController],
  providers: [AppService, FastqService, GlobalService, CommunicationService],
})
export class AppModule {}
