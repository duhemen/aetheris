# ── Stage 1: Build Tailwind CSS ──
FROM node:20-alpine AS css-builder
WORKDIR /build
COPY package.json tailwind.config.js ./
RUN npm install --no-audit --no-fund
COPY frontend/tailwind-input.css ./frontend/
COPY frontend/index.html frontend/v5-extras.js frontend/v6-rooms.js \
     frontend/v6-webgpu.js frontend/v7-auth.js frontend/v8-voice.js \
     frontend/v8-rooms-pro.js frontend/v8-ui-polish.js ./frontend/
RUN npx tailwindcss -i ./frontend/tailwind-input.css -o ./frontend/tailwind.css --minify

# ── Stage 2: Python app ──
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend

# Copy built CSS dari stage 1
COPY --from=css-builder /build/frontend/tailwind.css ./frontend/tailwind.css

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]