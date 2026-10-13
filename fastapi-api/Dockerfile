FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --uid 1000 --create-home app && mkdir -p /data/uploads && chown app:app /data/uploads
ENV ENVIRONMENT=production UPLOAD_DIR=/data/uploads PYTHONDONTWRITEBYTECODE=1
USER app
EXPOSE 5000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
