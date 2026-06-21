package main

import (
	"embed"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"strings"
)

//go:embed dist/*
var embeddedFiles embed.FS

func main() {
	// Explicitly map .wasm extension to application/wasm MIME type
	if err := mime.AddExtensionType(".wasm", "application/wasm"); err != nil {
		log.Printf("Warning: failed to add mime type for .wasm: %v", err)
	}

	// Retrieve the subdirectory 'dist' from the embedded FS
	distFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		log.Fatalf("Failed to load embedded files: %v", err)
	}

	// Serve files from the embedded FS
	fsServer := http.FileServer(http.FS(distFS))
	http.Handle("/", fsServer)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	log.Printf("WASM Markdown Editor serving at http://localhost%s ...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
