FROM debian:buster-slim AS builder
RUN apt update
RUN apt upgrade -y
RUN apt install -y g++ curl make tar gzip libfindbin-libs-perl
WORKDIR /build
RUN sh -c "$(curl -sSL https://raw.githubusercontent.com/just-js/just/0.1.2/install.sh)"
RUN make -C just-0.1.2 install
ENV JUST_HOME=/build/just-0.1.2
ENV JUST_TARGET=/build/just-0.1.2
WORKDIR /app
COPY techempower.js util.js tfb.js fortunes.html ./
RUN just build --clean --static techempower.js

FROM gcr.io/distroless/static:latest
COPY --from=builder /app/techempower /bin/techempower
COPY --from=builder /app/fortunes.html /bin/fortunes.html
ENV PGPOOL=1
CMD ["techempower"]
