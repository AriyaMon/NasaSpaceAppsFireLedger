# syntax=docker/dockerfile:1
# ==============================================================================
# FireLedger — Clean, Ultra-Lean Multi-Stage Alpine Linux Dockerfile
# ==============================================================================
# Stage 1 (node:22-alpine): Compiles the TypeScript + React + Tailwind frontend
# into static assets (/build/dist & /build/assets), then discards node_modules.
# Stage 2 (python:3.12-alpine): Installs only lightweight pure-Python runtime
# packages in an isolated /opt/venv and serves both the UI and APIs on port 3000.
#
# One-Command Build & Run:
#   docker compose up --build
# Or with plain Docker CLI:
#   docker build -t fireledger . && docker run --rm -p 3000:3000 fireledger
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Static Bundle Builder (Alpine Node.js)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /build

# Install dependencies first for optimal Docker layer caching
COPY package.json .npmrc ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy only the source files needed to build the frontend and GitHub Pages sync
COPY index.html vite.config.ts tsconfig.json metadata.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Build ./dist and sync ./assets + ./pages-loader.js
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime (Alpine Python 3.12)
# ------------------------------------------------------------------------------
FROM python:3.12-alpine AS runtime

LABEL org.opencontainers.image.title="FireLedger — NASA Space Apps Wildfire Observatory"
LABEL org.opencontainers.image.description="Harmonized MODIS, VIIRS & Landsat 8/9 Wildfire Observatory (Alpine Python + React)"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH" \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

# Create isolated Python virtual environment and install lean pure-Python requirements
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# Copy Python backend, baseline data ledger, and compiled frontend from Stage 1
COPY app.py .env.example dataset_meta.json harmonized_global_monthly.parquet ./
COPY data ./data
COPY --from=frontend-builder /build/dist ./dist
COPY --from=frontend-builder /build/assets ./assets
COPY --from=frontend-builder /build/pages-loader.js /build/index.html /build/404.html /build/.nojekyll ./

# Run as non-root user with writable data & SQLite queue directories
RUN adduser -D -u 10001 fireledger \
    && mkdir -p /app/data /app/database \
    && chown -R fireledger:fireledger /app

USER fireledger

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", 3000)}/api/health', timeout=4)" || exit 1

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-3000} --workers 2 --threads 4 --timeout 60 --access-logfile - app:app"]
