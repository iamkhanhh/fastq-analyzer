FROM node:20

RUN apt-get update && apt-get install -y \
    samtools \
    bcftools \
    tabix \
    wget \
    bzip2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


RUN wget --no-check-certificate \
        https://sourceforge.net/projects/bio-bwa/files/bwakit/bwakit-0.7.15_x64-linux.tar.bz2/download \
        -O bwa.tar.bz2 \
    && tar -xvjf bwa.tar.bz2 \
    && mkdir -p /apps \
    && mv bwa.kit /apps/bwa.kit \
    && rm bwa.tar.bz2

ENV PATH=$PATH:/apps/bwa.kit

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3002

CMD npm run start
