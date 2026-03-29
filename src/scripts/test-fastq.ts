import * as dotenv from 'dotenv';
dotenv.config();

import { CommonService } from '../services/common.service';
import { FastqService } from '../services/fastq.service';
import { AppService } from '../app.service';
import { AnalysisModel } from '../models/analysis.model';
import { ConfigService } from '@nestjs/config';

// ── Mock pending sample ────────────────────────────────────────────────────
const MOCK_ANALYSIS: AnalysisModel = {
    id: 6,
    name: 'test fastq',
    user_id: 1,
    sequencing_type: 'WES',
    igv_local_path: 'user_files/1/6',
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
    assembly: 'hg19',
    createdAt: new Date('2026-03-16T23:18:52.000Z'),
    updatedAt: new Date('2026-03-16T23:18:52.000Z'),
    fastq1: {
        id: 22,
        createdAt: new Date('2025-09-06T22:16:12.000Z'),
        updatedAt: new Date('2025-09-06T22:17:58.000Z'),
        original_name: 'K450018155_L01_57_1.fq.gz',
        file_size: 34634037,
        file_type: 'fastq',
        upload_name: 'K450018155_L01_57_1-1757222172770-48db1815-a510-4f54-86b9-b7ac3d28721b.fq.gz',
        is_deleted: 0,
        file_path: 'uploads/1/K450018155_L01_57_1-1757222172770-48db1815-a510-4f54-86b9-b7ac3d28721b.fq.gz',
        user_created: 1,
        sample_id: 16,
        fastq_pair_index: 1,
        upload_status: 1,
    },
    fastq2: {
        id: 23,
        createdAt: new Date('2025-09-06T22:16:17.000Z'),
        updatedAt: new Date('2025-09-06T22:17:58.000Z'),
        original_name: 'K450018155_L01_57_2.fq.gz',
        file_size: 35590526,
        file_type: 'fastq',
        upload_name: 'K450018155_L01_57_2-1757222177743-29fe75e5-11fa-49a6-8161-00da5f37a68d.fq.gz',
        is_deleted: 0,
        file_path: 'uploads/1/K450018155_L01_57_2-1757222177743-29fe75e5-11fa-49a6-8161-00da5f37a68d.fq.gz',
        user_created: 1,
        sample_id: 16,
        fastq_pair_index: 2,
        upload_status: 1,
    },
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
