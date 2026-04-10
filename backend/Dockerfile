FROM python:3.12-slim

WORKDIR /app

# Install deps first (separate layer = cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code (overridden by bind mount in dev, used as-is in prod)
COPY app/ ./app/

ENV FLASK_APP=app
ENV PYTHONUNBUFFERED=1

EXPOSE 5000
