# Reproducible Cloud Run runtime: Node app + pinned Playwright browser + FFmpeg + whisper.cpp.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git cmake build-essential pkg-config ca-certificates curl \
    libopenblas-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Pin whisper.cpp to a stable upstream release rather than tracking master.
RUN git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp.git /opt/whisper.cpp \
    && cmake -S /opt/whisper.cpp -B /opt/whisper.cpp/build \
       -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON \
    && cmake --build /opt/whisper.cpp/build --config Release --target whisper-cli -j2 \
    && install -m 0755 /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli \
    && bash /opt/whisper.cpp/models/download-ggml-model.sh base

WORKDIR /app
COPY package.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund

COPY . .
RUN npm run build \
    && mkdir -p /mnt/video-agent-studio \
    && chown -R pwuser:pwuser /app /mnt/video-agent-studio

ENV NODE_ENV=production \
    PORT=8080 \
    STORAGE_DIR=/mnt/video-agent-studio \
    WHISPER_CLI_PATH=/usr/local/bin/whisper-cli \
    WHISPER_MODEL_PATH=/opt/whisper.cpp/models/ggml-base.bin \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

USER pwuser
EXPOSE 8080
CMD ["npm", "start"]
