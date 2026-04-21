import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastqService, GlobalService } from './services';
import { CommonService } from './services/common.service';
import { CommunicationService } from './services/communication.service';
import { AnalysisModel, AnalysisStatus } from './models/analysis.model';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs'
import { BGZIP_CMD, FASTQ1_FILE, FASTQ1_FILE_ZIP, FASTQ2_FILE, FASTQ2_FILE_ZIP } from './constants';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  analysis: AnalysisModel;
  private s3Dir: string; 
  private fastq1: string;
  private fastq2: string;
  private analysisFolder: string;
  private isGZ_fast1: boolean = false;
  private isGZ_fast2: boolean = false;

  constructor(
    private readonly fastqService: FastqService,
    private readonly commonService: CommonService,
    private readonly configService: ConfigService,
    private readonly globalService: GlobalService,
    private readonly communicationService: CommunicationService,
  ) {
    this.s3Dir = this.configService.get<string>('AWS_DIR');
  }

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
    this.logger.log(`Starting GATK pipeline for analysis ID: ${analysis.id}`);
    try {
      this.analysis       = analysis;
      this.analysisFolder = this.commonService.getAnalysisFolder(analysis);

      await this.prepreocess();

      await this.fastqService.alignVariant(
        analysis.assembly,
        this.analysisFolder,
        this.isGZ_fast1,
        analysis.id,
      );

      await this.fastqService.markDuplicates(this.analysisFolder);

      await this.fastqService.baseRecalibration(
        analysis.assembly,
        this.analysisFolder,
        analysis.sequencing_type,
      );

      await this.fastqService.haplotypeCall(
        analysis.assembly,
        this.analysisFolder,
        analysis.sequencing_type,
      );

      await this.fastqService.genotypeGvcf(
        analysis.assembly,
        this.analysisFolder,
      );

      await this.fastqService.filterVariants(this.analysisFolder);

      this.logger.log(`GATK pipeline completed for analysis ID: ${analysis.id}`);
    } catch (error) {
      this.logger.error(`GATK pipeline failed for analysis ID ${this.analysis.id}`, error);
      throw error;
    }
  }

  async prepreocess() {
    this.logger.log('Preprocessing FASTQ files');

    let copyOriginalFile = '';
    let commandZip = '';
    this.isGZ_fast1 = this.analysis.fastq1.file_path.indexOf('.gz') != -1 ? true : false;
    this.isGZ_fast2 = this.analysis.fastq2.file_path.indexOf('.gz') != -1 ? true : false;
    this.fastq1 = `${this.analysisFolder}/${this.isGZ_fast1 ? FASTQ1_FILE_ZIP : FASTQ1_FILE}`;
    this.fastq2 = `${this.analysisFolder}/${this.isGZ_fast2 ? FASTQ2_FILE_ZIP : FASTQ2_FILE}`;

    if (!fs.existsSync(`${this.s3Dir}/${this.analysis.fastq1.file_path}`) || !fs.existsSync(`${this.s3Dir}/${this.analysis.fastq2.file_path}`)) {
      throw new Error('Original fastq file not found!');
    }

    if (!fs.existsSync(`${this.s3Dir}/${this.fastq1}`)) {
      this.logger.log('Copy fastq1 file!');
      copyOriginalFile += ` && cp ${this.analysis.fastq1.file_path} ${this.fastq1}`;
    }

    if (!fs.existsSync(`${this.s3Dir}/${this.fastq2}`)) {
      this.logger.log('Copy fast2 file!');
      copyOriginalFile += ` && cp ${this.analysis.fastq2.file_path} ${this.fastq2}`;
    }

    if (!((this.isGZ_fast1 && this.isGZ_fast2) || (!this.isGZ_fast1 && !this.isGZ_fast2))) {
      this.logger.log('Fastq files are not in the same format, normalizing compression');

      if (!this.isGZ_fast1) {
        commandZip += ` && ${BGZIP_CMD} ${this.fastq1}`;
      } else if (!this.isGZ_fast2) {
        commandZip += ` && ${BGZIP_CMD} ${this.fastq2}`;
      }
    }

    let command = `cd ${this.s3Dir} ${copyOriginalFile} ${commandZip}`;
    return await this.commonService.runCommand(command);
  }

  getHello(): string {
    return 'Hello World!';
  }
}
