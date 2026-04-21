import { Injectable, Logger } from '@nestjs/common';
import { CommonService } from './common.service';
import { ConfigService } from '@nestjs/config';
import {
    BAM_FILE, BAM_INDEX_FILE, SORTED_BAM_FILE, SAM_FILE,
    FASTQ1_FILE, FASTQ1_FILE_ZIP, FASTQ2_FILE, FASTQ2_FILE_ZIP,
    BWA_CMD, SAMTOOLS_CMD, GATK_CMD, GATK_JVM_OPTS,
    MARKDUP_BAM_FILE, MARKDUP_METRICS_FILE,
    RECAL_TABLE_FILE, RECAL_BAM_FILE,
    GVCF_FILE, GENOTYPED_VCF_FILE, VCF_OUTPUT_FILE,
} from 'src/constants';

@Injectable()
export class FastqService {
    private readonly logger = new Logger(FastqService.name);

    private s3Dir: string;
    private hg19_fasta: string;
    private hg38_fasta: string;
    private knownSites: Record<string, string[]>;
    private wesBed: Record<string, string>;

    constructor(
        private readonly commonService: CommonService,
        private readonly configService: ConfigService,
    ) {
        this.s3Dir      = this.configService.get<string>('AWS_DIR');
        this.hg19_fasta = this.configService.get<string>('FASTA_HG19_FILE');
        this.hg38_fasta = this.configService.get<string>('FASTA_HG38_FILE');

        this.knownSites = {
            hg19: [
                this.configService.get<string>('KNOWN_SITES_DBSNP_HG19'),
                this.configService.get<string>('KNOWN_SITES_MILLS_HG19'),
            ],
            hg38: [
                this.configService.get<string>('KNOWN_SITES_DBSNP_HG38'),
                this.configService.get<string>('KNOWN_SITES_MILLS_HG38'),
                this.configService.get<string>('KNOWN_SITES_INDELS_HG38'),
            ],
        };

        this.wesBed = {
            hg19: this.configService.get<string>('WES_BED_HG19'),
            hg38: this.configService.get<string>('WES_BED_HG38'),
        };
    }

    private getFasta(assembly: string): string {
        return assembly === 'hg19' ? this.hg19_fasta : this.hg38_fasta;
    }

    private getIntervalArg(assembly: string, sequencingType: string): string {
        if (sequencingType !== 'WES') return '';
        const bed = this.wesBed[assembly];
        return bed ? `-L ${bed}` : '';
    }

    // Alignment — BWA-MEM2 + Read Group
    async alignVariant(assembly: string, analysisFolder: string, isGz: boolean, analysisId: number) {
        this.logger.log(`[Step 1/6] BWA-MEM2 alignment — assembly=${assembly}`);

        const fasta     = this.getFasta(assembly);
        const read1     = isGz ? FASTQ1_FILE_ZIP : FASTQ1_FILE;
        const read2     = isGz ? FASTQ2_FILE_ZIP : FASTQ2_FILE;
        const readGroup = `@RG\\tID:${analysisId}\\tSM:sample_${analysisId}\\tPL:ILLUMINA\\tLB:lib_${analysisId}`;

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            `${BWA_CMD} mem -t 4 -R "${readGroup}" ${fasta} ${read1} ${read2} > ${SAM_FILE}`,
            `${SAMTOOLS_CMD} view -S -b ${SAM_FILE} > ${BAM_FILE}`,
            `${SAMTOOLS_CMD} sort -o ${SORTED_BAM_FILE} ${BAM_FILE}`,
            `${SAMTOOLS_CMD} index ${SORTED_BAM_FILE}`,
            `rm -f ${SAM_FILE} ${BAM_FILE}`,
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }

    // MarkDuplicates
    async markDuplicates(analysisFolder: string) {
        this.logger.log(`[Step 2/6] GATK MarkDuplicates`);

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            [
                `${GATK_CMD} ${GATK_JVM_OPTS} MarkDuplicates`,
                `-I ${SORTED_BAM_FILE}`,
                `-O ${MARKDUP_BAM_FILE}`,
                `-M ${MARKDUP_METRICS_FILE}`,
                `--VALIDATION_STRINGENCY LENIENT`,
                `--CREATE_INDEX true`,
            ].join(' '),
            `rm -f ${SORTED_BAM_FILE} ${BAM_INDEX_FILE}`,
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }

    // Base Quality Score Recalibration (BQSR)
    async baseRecalibration(assembly: string, analysisFolder: string, sequencingType: string) {
        this.logger.log(`[Step 3/6] BQSR — BaseRecalibrator + ApplyBQSR (${sequencingType})`);

        const fasta          = this.getFasta(assembly);
        const knownSitesArgs = (this.knownSites[assembly] || [])
            .filter(Boolean)
            .map(site => `--known-sites ${site}`)
            .join(' ');
        const intervalArg    = this.getIntervalArg(assembly, sequencingType);

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            [
                `${GATK_CMD} ${GATK_JVM_OPTS} BaseRecalibrator`,
                `-I ${MARKDUP_BAM_FILE}`,
                `-R ${fasta}`,
                intervalArg,
                knownSitesArgs,
                `-O ${RECAL_TABLE_FILE}`,
            ].filter(Boolean).join(' '),
            [
                `${GATK_CMD} ${GATK_JVM_OPTS} ApplyBQSR`,
                `-I ${MARKDUP_BAM_FILE}`,
                `-R ${fasta}`,
                `--bqsr-recal-file ${RECAL_TABLE_FILE}`,
                `-O ${RECAL_BAM_FILE}`,
            ].join(' '),
            `rm -f ${MARKDUP_BAM_FILE} ${MARKDUP_BAM_FILE}.bai`,
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }

    // HaplotypeCaller
    async haplotypeCall(assembly: string, analysisFolder: string, sequencingType: string) {
        this.logger.log(`[Step 4/6] GATK HaplotypeCaller (gVCF mode, ${sequencingType})`);

        const fasta       = this.getFasta(assembly);
        const intervalArg = this.getIntervalArg(assembly, sequencingType);

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            [
                `${GATK_CMD} ${GATK_JVM_OPTS} HaplotypeCaller`,
                `-R ${fasta}`,
                `-I ${RECAL_BAM_FILE}`,
                intervalArg,
                `-O ${GVCF_FILE}`,
                `-ERC GVCF`,
                `--sample-ploidy 2`,
                `--native-pair-hmm-threads 4`,
            ].filter(Boolean).join(' '),
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }

    // GenotypeGVCFs
    async genotypeGvcf(assembly: string, analysisFolder: string) {
        this.logger.log(`[Step 5/6] GATK GenotypeGVCFs`);

        const fasta = this.getFasta(assembly);

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            [
                `${GATK_CMD} ${GATK_JVM_OPTS} GenotypeGVCFs`,
                `-R ${fasta}`,
                `-V ${GVCF_FILE}`,
                `-O ${GENOTYPED_VCF_FILE}`,
            ].join(' '),
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }

    // VariantFiltration — SNP và INDEL
    async filterVariants(analysisFolder: string) {
        this.logger.log(`[Step 6/6] GATK VariantFiltration (SNP + INDEL separate)`);

        const command = [
            `cd ${this.s3Dir}/${analysisFolder}`,
            `${GATK_CMD} SelectVariants -V ${GENOTYPED_VCF_FILE} --select-type-to-include SNP -O snps.vcf.gz`,
            `${GATK_CMD} SelectVariants -V ${GENOTYPED_VCF_FILE} --select-type-to-include INDEL -O indels.vcf.gz`,
            [
                `${GATK_CMD} VariantFiltration -V snps.vcf.gz`,
                `--filter-expression "QD < 2.0"          --filter-name "QD2"`,
                `--filter-expression "FS > 60.0"         --filter-name "FS60"`,
                `--filter-expression "MQ < 40.0"         --filter-name "MQ40"`,
                `--filter-expression "MQRankSum < -12.5" --filter-name "MQRankSum-12.5"`,
                `--filter-expression "ReadPosRankSum < -8.0" --filter-name "ReadPosRankSum-8"`,
                `-O snps.filtered.vcf.gz`,
            ].join(' '),
            [
                `${GATK_CMD} VariantFiltration -V indels.vcf.gz`,
                `--filter-expression "QD < 2.0"               --filter-name "QD2"`,
                `--filter-expression "FS > 200.0"             --filter-name "FS200"`,
                `--filter-expression "ReadPosRankSum < -20.0" --filter-name "ReadPosRankSum-20"`,
                `-O indels.filtered.vcf.gz`,
            ].join(' '),
            `${GATK_CMD} MergeVcfs -I snps.filtered.vcf.gz -I indels.filtered.vcf.gz -O ${VCF_OUTPUT_FILE}`,
            `rm -f snps.vcf.gz snps.vcf.gz.tbi indels.vcf.gz indels.vcf.gz.tbi`,
            `rm -f snps.filtered.vcf.gz snps.filtered.vcf.gz.tbi indels.filtered.vcf.gz indels.filtered.vcf.gz.tbi`,
            `rm -f ${GENOTYPED_VCF_FILE} ${GENOTYPED_VCF_FILE}.tbi`,
        ].join(' && ');

        return await this.commonService.runCommand(command);
    }
}
