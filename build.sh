#!/bin/bash
set -e

echo "Building WasmDEdit..."

# Detect go binary location
if command -v go >/dev/null 2>&1; then
  GO_BIN="go"
elif [ -x "/snap/bin/go" ]; then
  GO_BIN="/snap/bin/go"
elif [ -x "/usr/local/go/bin/go" ]; then
  GO_BIN="/usr/local/go/bin/go"
else
  echo "Error: Go is not installed. Please install Go to build the project." >&2
  exit 1
fi

echo "Using Go binary: $GO_BIN"

# 1. Create dist directory if it doesn't exist
mkdir -p dist

# 2. Copy static files to dist/
echo "Copying static assets..."
cp src/index.html dist/
cp src/styles.css dist/
cp src/app.js dist/
cp src/wasm_exec.js dist/

# 3. Build WebAssembly parser
echo "Compiling WebAssembly module..."
cd src
GOOS=js GOARCH=wasm "$GO_BIN" build -o ../dist/main.wasm main.go
cd ..

# 4. Build native server binary (embedding dist/)
echo "Compiling native server binary..."
mkdir -p bin
"$GO_BIN" build -ldflags="-s -w" -o bin/wasmdedit .

# 5. Build Windows server binary (embedding dist/)
echo "Compiling Windows server binary (cross-compilation)..."
GOOS=windows GOARCH=amd64 "$GO_BIN" build -ldflags="-s -w" -o bin/wasmdedit.exe .

echo "Build complete! Static assets are in 'dist', executables are in 'bin'."
