.PHONY: run test build vet

run:
	go run ./cmd/server

test:
	go test ./...

build:
	CGO_ENABLED=0 go build -o bin/vkusvill-collections ./cmd/server

vet:
	go vet ./...
