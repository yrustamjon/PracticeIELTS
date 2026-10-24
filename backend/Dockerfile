FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=secret,id=build_ca,target=/run/secrets/build-ca \
    if [ -f /run/secrets/build-ca ]; then export PIP_CERT=/run/secrets/build-ca; fi; \
    pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
