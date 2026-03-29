import { Injectable, Logger } from '@nestjs/common';
import { CommonService } from './common.service';
import { ConfigService } from '@nestjs/config';
import { BAM_FILE, BCF_FILE, BCFTOOLS_CMD, BWA_CMD, FASTQ1_FILE, FASTQ1_FILE_ZIP, FASTQ2_FILE, FASTQ2_FILE_ZIP, SAM_FILE, SAMTOOLS_CMD, SORTED_BAM_FILE, VCF_OUTPUT_FILE } from 'src/constants';

@Injectable()
export class FastqService {
    private readonly logger = new Logger(FastqService.name);

    private s3Dir: string;
    private hg19_fasta: string;
    private hg38_fasta: string;
    private hg19_wes: string;
    private hg38_wes: string;

    constructor(
        private readonly commonService: CommonService,
        private readonly configService: ConfigService,
    ) {
        this.s3Dir = this.configService.get<string>('AWS_DIR');
        this.hg19_fasta = this.configService.get<string>('FASTA_HG19_FILE');
        this.hg38_fasta = this.configService.get<string>('FASTA_HG38_FILE');
        this.hg19_wes = this.configService.get<string>('WES_HG19_FILE');
        this.hg38_wes = this.configService.get<string>('WES_HG38_FILE');
    }

    async alignVarriant(assemly: string, analysisFolder: string, isGz: boolean) {
        this.logger.log('Aligning variant');
        let read1 = isGz ? FASTQ1_FILE_ZIP : FASTQ1_FILE;
        let read2 = isGz ? FASTQ2_FILE_ZIP : FASTQ2_FILE;

        if (assemly === 'hg19') {
            this.logger.log('Using hg19 reference genome');

            let command = [
                `cd ${this.s3Dir}/${analysisFolder}`,
                `${BWA_CMD} mem ${this.hg19_fasta} ${read1} ${read2} > ${SAM_FILE}`,
                `${SAMTOOLS_CMD} view -S -b ${SAM_FILE} > ${BAM_FILE}`,
                `${SAMTOOLS_CMD} sort -o ${SORTED_BAM_FILE} ${BAM_FILE}`,
                `${SAMTOOLS_CMD} index ${SORTED_BAM_FILE}`
            ]

            return await this.commonService.runCommand(command.join(' && '));

        } else if (assemly === 'hg38') {
            this.logger.log('Using hg38 reference genome');

            let command = [
                `cd ${this.s3Dir}/${analysisFolder}`,
                `${BWA_CMD} mem ${this.hg38_fasta} ${read1} ${read2} > ${SAM_FILE}`,
                `${SAMTOOLS_CMD} view -S -b ${SAM_FILE} > ${BAM_FILE}`,
                `${SAMTOOLS_CMD} sort -o ${SORTED_BAM_FILE} ${BAM_FILE}`,
                `${SAMTOOLS_CMD} index ${SORTED_BAM_FILE}`
            ]

            return await this.commonService.runCommand(command.join(' && '));
        } else {
            throw new Error('Invalid assembly version');
        }
    }

    async variantCalling(assemly: string, analysisFolder: string) {
        this.logger.log('Variant calling');

        if (assemly === 'hg19') {
            let command = [
                `cd ${this.s3Dir}/${analysisFolder}`,
                `${BCFTOOLS_CMD} mpileup -O b -o ${BCF_FILE} -f ${this.hg19_fasta} ${SORTED_BAM_FILE}`,
                `${BCFTOOLS_CMD} call --ploidy 2 -m -v -Oz -o ${VCF_OUTPUT_FILE} ${BCF_FILE}`
            ]

            return await this.commonService.runCommand(command.join(' && '));
        } else if (assemly === 'hg38') {
            let command = [
                `cd ${this.s3Dir}/${analysisFolder}`,
                `${BCFTOOLS_CMD} mpileup -O b -o ${BCF_FILE} -f ${this.hg38_fasta} ${SORTED_BAM_FILE}`,
                `${BCFTOOLS_CMD} call --ploidy 2 -m -v -Oz -o ${VCF_OUTPUT_FILE} ${BCF_FILE}`
            ]

            return await this.commonService.runCommand(command.join(' && '));
        } else {
            throw new Error('Invalid assembly version');
        }
    }
}
