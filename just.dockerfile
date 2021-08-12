FROM debian:buster-slim AS builder
RUN apt update
RUN apt upgrade -y
RUN apt install -y g++ curl make tar gzip libfindbin-libs-perl
#COPY just /usr/local/bin/just
RUN curl -L -o /usr/local/bin/just https://github.com/just-js/just/releases/download/0.1.2/just
WORKDIR /app
COPY placeholder.js ./
RUN just build --clean --static placeholder.js
COPY techempower.js util.js tfb.js fortunes.html ./
RUN just build --clean --static techempower.js

FROM gcr.io/distroless/static:latest
COPY --from=builder /app/techempower /bin/techempower
COPY --from=builder /app/fortunes.html /bin/fortunes.html
ENV PGPOOL=1
CMD ["techempower"]
