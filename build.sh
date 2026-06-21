#!/bin/bash
set -e

echo "Building WasmDEdit..."

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
GOOS=js GOARCH=wasm go build -o ../dist/main.wasm main.go
cd ..

# 4. Build native server binary (embedding dist/)
echo "Compiling native server binary..."
go build -o dist/server server.go

echo "Build complete! Output is in the 'dist' directory."
