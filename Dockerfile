FROM node:20-slim

# Hugging Face runs Docker Spaces as UID 1000
RUN useradd -m -u 1000 user

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --chown=user . .
USER user

# HF Spaces expects the app on port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
