// === Output files ===
export const VCF_OUTPUT_FILE        = 'analysis.fastq.vcf.gz'
export const VCF_RAW_FILE           = 'analysis.raw.vcf.gz'
export const SAM_FILE               = 'analysis.aligned.sam'
export const BAM_FILE               = 'analysis.aligned.bam'
export const BAM_INDEX_FILE         = 'analysis.aligned.sorted.bam.bai'
export const SORTED_BAM_FILE        = 'analysis.aligned.sorted.bam'
export const BCF_FILE               = 'analysis.bcf'
export const FASTQ1_FILE            = 'fastq_1.fq'
export const FASTQ1_FILE_ZIP        = 'fastq_1.fq.gz'
export const FASTQ2_FILE            = 'fastq_2.fq'
export const FASTQ2_FILE_ZIP        = 'fastq_2.fq.gz'

// === GATK pipeline files ===
export const MARKDUP_BAM_FILE       = 'analysis.markdup.bam'
export const MARKDUP_METRICS_FILE   = 'analysis.markdup.metrics.txt'
export const RECAL_TABLE_FILE       = 'analysis.recal.table'
export const RECAL_BAM_FILE         = 'analysis.recal.bam'
export const GVCF_FILE              = 'analysis.g.vcf.gz'
export const GENOTYPED_VCF_FILE     = 'analysis.genotyped.vcf.gz'

// === Commands ===
export const SAMTOOLS_CMD           = 'samtools'
export const BWA_CMD                = 'bwa-mem2'
export const BCFTOOLS_CMD           = 'bcftools'
export const BGZIP_CMD              = 'bgzip'

export const GATK_CMD               = process.env.GATK_CMD || 'gatk'

// Điều chỉnh -Xmx theo RAM server thực tế (8g cho 16GB RAM)
export const GATK_JVM_OPTS          = '--java-options "-Xmx8g -XX:+UseParallelGC"'