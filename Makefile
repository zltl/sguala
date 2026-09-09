# sguala — agentless SSH monitor (CLI / TUI)
#
# Primary product at repo root. Optional Electron UI lives under desktop/.

.PHONY: build run test tidy clean fmt install demo

BIN := bin/sguala
VERSION ?= 0.2.0

build:
	@mkdir -p bin
	go build -ldflags="-s -w -X main.version=$(VERSION)" -o $(BIN) ./cmd/sguala

run: build
	./$(BIN)

test:
	SGUALA_SECRET_FILE_ONLY=1 go test ./...

tidy:
	go mod tidy

fmt:
	go fmt ./...

clean:
	rm -rf bin dist

install: build
	install -m 755 $(BIN) "$(HOME)/.local/bin/sguala"

# Regenerate ASCII video demo assets under doc/ (cast + SVG)
demo:
	go run ./scripts/gendemo
