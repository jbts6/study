FROM golang:1.25.1-bookworm

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin runner

ENV CGO_ENABLED=0 \
    GOTOOLCHAIN=local \
    GOPROXY=off \
    GOSUMDB=off \
    GOTELEMETRY=off

WORKDIR /workspace
USER 10001:10001
