package main

import (
	"log"
	"mime"
	"net/http"
)

func main() {
	// Explicitly map .wasm extension to application/wasm MIME type
	// This ensures the browser can compile/stream the WASM module without warnings.
	if err := mime.AddExtensionType(".wasm", "application/wasm"); err != nil {
		log.Printf("Warning: failed to add mime type for .wasm: %v", err)
	}

	// Serve files from the current directory
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	port := ":8080"
	log.Printf("WASM Markdown Editor serving at http://localhost%s ...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
