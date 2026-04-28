FROM denoland/deno:alpine-2.0.0
WORKDIR /app
COPY main.ts .
EXPOSE 8000
CMD ["run", "--allow-net", "--allow-env", "main.ts"]

