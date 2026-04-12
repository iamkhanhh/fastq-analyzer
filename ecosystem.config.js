module.exports = {
  apps: [
    {
      name: 'fastq-analyzer',
      script: 'dist/main.js',
      instances: 1,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
