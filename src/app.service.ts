import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastqService, GlobalService } from './services';
import { CommonService } from './services/common.service';
import { CommunicationService } from './services/communication.service';
import { AnalysisModel, AnalysisStatus } from './models/analysis.model';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  analysis: AnalysisModel;

  constructor(
    private readonly fastqService: FastqService,
    private readonly commonService: CommonService,
    private readonly configService: ConfigService,
    private readonly globalService: GlobalService,
    private readonly communicationService: CommunicationService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async fastq_analyzer() {
    let pendingAnalysis;
    try {
      if (this.globalService.isAnalyzing) {
        return;
      }

      pendingAnalysis = await this.communicationService.getPendingAnalysis();
      if (!pendingAnalysis) {
        this.logger.log('No pending analysis found');
        this.globalService.isAnalyzing = false;
        return;
      }

      this.globalService.isAnalyzing = true;
      this.logger.log('Starting FASTQ analysis');
      console.log(pendingAnalysis);

      await this.communicationService.updateAnalysisStatus(pendingAnalysis.id, AnalysisStatus.FASTQ_ANALYZING);

      await this.analyze(pendingAnalysis);

      await this.communicationService.updateAnalysisStatus(pendingAnalysis.id, AnalysisStatus.QUEUING);

      return this.globalService.isAnalyzing = false;

    } catch (error) {
      this.globalService.isAnalyzing = false;
      this.logger.error('Error in fastq_analyzer', error);
      await this.communicationService.updateAnalysisStatus(pendingAnalysis.id, AnalysisStatus.FASTQ_ERROR);
    }
  }

  async analyze(analysis: AnalysisModel) {
    this.logger.log(`Analyzing VCF for analysis ID: ${analysis.id}`);
    try {

      this.logger.log('Done Analysis')
    } catch (error) {
      this.logger.error(`Error analyzing VCF for analysis ID ${this.analysis.id}`, error);
      throw error;
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
