FROM broadinstitute/gatk:4.5.0.0

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    samtools \
    bcftools \
    tabix \
    wget \
    bzip2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# BWA-MEM2
RUN wget --no-check-certificate \
        https://github.com/bwa-mem2/bwa-mem2/releases/download/v2.2.1/bwa-mem2-2.2.1_x64-linux.tar.bz2 \
        -O bwa-mem2.tar.bz2 \
    && tar -xvjf bwa-mem2.tar.bz2 \
    && mkdir -p /apps \
    && mv bwa-mem2-2.2.1_x64-linux /apps/bwa-mem2 \
    && rm bwa-mem2.tar.bz2

ENV PATH=$PATH:/apps/bwa-mem2

RUN npm install -g pm2

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3002

CMD ["pm2-runtime", "ecosystem.config.js"]
