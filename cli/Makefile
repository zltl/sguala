# sguala-cli — agentless SSH monitor (TUI)
#
# Independent of the Electron desktop app under the repo root.
# Does not share runtime or config format with the desktop UI.

.PHONY: build run test tidy clean fmt

BIN := bin/sguala

build:
	@mkdir -p bin
	go build -ldflags="-s -w -X main.version=0.1.0" -o $(BIN) ./cmd/sguala

run: build
	./$(BIN)

test:
	go test ./...

tidy:
	go mod tidy

fmt:
	go fmt ./...

clean:
	rm -rf bin dist

install: build
	install -m 755 $(BIN) "$(HOME)/.local/bin/sguala"
