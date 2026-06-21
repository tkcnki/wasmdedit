package main

import (
	"log"
	"mime"
	"net/http"
	"os"
	"strings"
)

func main() {
	// Explicitly map .wasm extension to application/wasm MIME type
	if err := mime.AddExtensionType(".wasm", "application/wasm"); err != nil {
		log.Printf("Warning: failed to add mime type for .wasm: %v", err)
	}

	// Serve files from the current directory
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

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
