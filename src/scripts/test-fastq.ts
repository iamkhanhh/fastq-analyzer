import * as dotenv from 'dotenv';
dotenv.config();

import { CommonService } from '../services/common.service';
import { FastqService } from '../services/fastq.service';
import { AppService } from '../app.service';
import { AnalysisModel } from '../models/analysis.model';
import { ConfigService } from '@nestjs/config';

// ── Parse assembly argument ────────────────────────────────────────────────
const VALID_ASSEMBLIES = ['hg19', 'hg38'];
const assembly = process.argv[2];

if (!assembly || !VALID_ASSEMBLIES.includes(assembly)) {
    console.error(`Usage: npm run test-fastq -- <assembly>`);
    console.error(`  assembly: ${VALID_ASSEMBLIES.join(' | ')}`);
    console.error(`\nExample:`);
    console.error(`  npm run test-fastq -- hg19`);
    console.error(`  npm run test-fastq -- hg38`);
    process.exit(1);
}

// ── Mock samples per assembly ──────────────────────────────────────────────
const MOCK_SAMPLES: Record<string, Partial<AnalysisModel>> = {
    hg19: {
        id: 7,
        assembly: 'hg19',
        igv_local_path: 'user_files/1/7',
        fastq1: {
            id: 22,
            createdAt: new Date('2025-09-06T22:16:12.000Z'),
            updatedAt: new Date('2025-09-06T22:17:58.000Z'),
            original_name: 'NA12878_L1_1.fastq.gz',
            file_size: 34634037,
            file_type: 'fastq',
            upload_name: 'NA12878_L1_1-1757222172770-48db1815-a510-4f54-86b9-b7ac3d28721b.fq.gz',
            is_deleted: 0,
            file_path: 'uploads/1/NA12878_L1_1.fastq.gz',
            user_created: 1,
            sample_id: 16,
            fastq_pair_index: 1,
            upload_status: 1,
        },
        fastq2: {
            id: 23,
            createdAt: new Date('2025-09-06T22:16:17.000Z'),
            updatedAt: new Date('2025-09-06T22:17:58.000Z'),
            original_name: 'NA12878_L1_2.fastq.gz',
            file_size: 35590526,
            file_type: 'fastq',
            upload_name: 'NA12878_L1_2-1757222177743-29fe75e5-11fa-49a6-8161-00da5f37a68d.fq.gz',
            is_deleted: 0,
            file_path: 'uploads/1/NA12878_L1_2.fastq.gz',
            user_created: 1,
            sample_id: 16,
            fastq_pair_index: 2,
            upload_status: 1,
        },
    },
    hg38: {
        id: 8,
        assembly: 'hg38',
        igv_local_path: 'user_files/1/8',
        fastq1: {
            id: 24,
            createdAt: new Date('2025-09-06T22:16:12.000Z'),
            updatedAt: new Date('2025-09-06T22:17:58.000Z'),
            original_name: 'NA12878_L1_1.fastq.gz',
            file_size: 34634037,
            file_type: 'fastq',
            upload_name: 'NA12878_L1_1-1757222172770-48db1815-a510-4f54-86b9-b7ac3d28721b.fq.gz',
            is_deleted: 0,
            file_path: 'uploads/1/NA12878_L1_1.fastq.gz',
            user_created: 1,
            sample_id: 16,
            fastq_pair_index: 1,
            upload_status: 1,
        },
        fastq2: {
            id: 25,
            createdAt: new Date('2025-09-06T22:16:17.000Z'),
            updatedAt: new Date('2025-09-06T22:17:58.000Z'),
            original_name: 'NA12878_L1_2.fastq.gz',
            file_size: 35590526,
            file_type: 'fastq',
            upload_name: 'NA12878_L1_2-1757222177743-29fe75e5-11fa-49a6-8161-00da5f37a68d.fq.gz',
            is_deleted: 0,
            file_path: 'uploads/1/NA12878_L1_2.fastq.gz',
            user_created: 1,
            sample_id: 16,
            fastq_pair_index: 2,
            upload_status: 1,
        },
    },
};

const MOCK_ANALYSIS: AnalysisModel = {
    name: 'test fastq',
    user_id: 1,
    sequencing_type: 'WES',
    sample_id: 16,
    project_id: 14,
    p_type: 'fastq',
    analyzed: null,
    variants: null,
    size: 70224563,
    status: 6,
    variants_to_report: null,
    file_path: null,
    description: 'fastq',
    is_deleted: 0,
    pipeline_id: 1,
    upload_id: 22,
    createdAt: new Date('2026-03-16T23:18:52.000Z'),
    updatedAt: new Date('2026-03-16T23:18:52.000Z'),
    ...MOCK_SAMPLES[assembly],
} as any;

// ── Minimal stubs (no HTTP, no DB) ─────────────────────────────────────────
class StubConfigService {
    get<T>(key: string, defaultValue?: T): T {
        return (process.env[key] ?? defaultValue) as T;
    }
}

class StubCommonService extends CommonService {
    constructor(configService: ConfigService) {
        super(configService);
    }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function main() {
    console.log('\n=== FASTQ Test Runner ===\n');

    const configService = new StubConfigService() as unknown as ConfigService;
    const commonService = new StubCommonService(configService);
    const fastqService = new FastqService(commonService, configService);

    // Minimal AppService without cron / HTTP dependencies
    const appService = new AppService(
        fastqService,
        commonService,
        configService,
        { isAnalyzing: false } as any,
        {
            getPendingAnalysis: async () => MOCK_ANALYSIS,
            updateAnalysisStatus: async (id: number, status: number) => {
                console.log(`[CommunicationService] updateAnalysisStatus id=${id} status=${status}`);
            },
        } as any,
    );

    try {
        console.log(`Sample ID  : ${MOCK_ANALYSIS.id}`);
        console.log(`Assembly   : ${MOCK_ANALYSIS.assembly}`);
        console.log(`fastq1     : ${MOCK_ANALYSIS.fastq1.file_path}`);
        console.log(`fastq2     : ${MOCK_ANALYSIS.fastq2.file_path}`);
        console.log('');

        await appService.analyze(MOCK_ANALYSIS);

        console.log('\n=== Analysis completed successfully ===\n');
    } catch (err) {
        console.error('\n=== Analysis FAILED ===');
        console.error(err);
        process.exit(1);
    }
}

main();
