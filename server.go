package main

import (
	"compress/gzip"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed dist/*
var embeddedFiles embed.FS

// Config represents the application configuration
type Config struct {
	Port         int    `json:"port"`
	Host         string `json:"host"`
	AutoOpen     bool   `json:"auto_open"`
	LocalSyncDir string `json:"local_sync_dir"`
	EnableGzip   bool   `json:"enable_gzip"`
}

// Default configuration settings
var defaultConfig = Config{
	Port:         8080,
	Host:         "127.0.0.1",
	AutoOpen:     true,
	LocalSyncDir: "",
	EnableGzip:   true,
}

// gzipResponseWriter wraps http.ResponseWriter to compress output
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func (w gzipResponseWriter) WriteHeader(statusCode int) {
	w.ResponseWriter.WriteHeader(statusCode)
}

func makeGzipHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		// Do not compress API responses
		if strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()

		gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

// openBrowser launches the system default browser
func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		log.Printf("Warning: failed to open browser automatically: %v", err)
	}
}

func loadOrCreateConfig() (*Config, string, error) {
	configName := "wasmdedit.json"

	// 1. Check current directory
	if _, err := os.Stat(configName); err == nil {
		cfg, err := readConfigFile(configName)
		return cfg, configName, err
	}

	// 2. Check executable directory
	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		execConfigPath := filepath.Join(execDir, configName)
		if _, err := os.Stat(execConfigPath); err == nil {
			cfg, err := readConfigFile(execConfigPath)
			return cfg, execConfigPath, err
		}

		// Try to create in executable directory
		err = writeDefaultConfig(execConfigPath)
		if err == nil {
			cfg, err := readConfigFile(execConfigPath)
			return cfg, execConfigPath, err
		}
	}

	// 3. Fallback to creating in current directory
	err = writeDefaultConfig(configName)
	if err != nil {
		return nil, "", err
	}
	cfg, err := readConfigFile(configName)
	return cfg, configName, err
}

func readConfigFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func writeDefaultConfig(path string) error {
	data, err := json.MarshalIndent(defaultConfig, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func main() {
	// Explicitly map .wasm extension to application/wasm MIME type
	if err := mime.AddExtensionType(".wasm", "application/wasm"); err != nil {
		log.Printf("Warning: failed to add mime type for .wasm: %v", err)
	}

	// Load configuration
	cfg, cfgPath, err := loadOrCreateConfig()
	if err != nil {
		log.Printf("Warning: failed to load config (using defaults): %v\n", err)
		cfg = &defaultConfig
	} else {
		log.Printf("Loaded config from: %s\n", cfgPath)
	}

	// Set up local directory sync if configured
	var syncDir string
	if cfg.LocalSyncDir != "" {
		syncDir, err = filepath.Abs(cfg.LocalSyncDir)
		if err != nil {
			log.Printf("Warning: failed to resolve absolute path for local_sync_dir: %v\n", err)
			syncDir = cfg.LocalSyncDir
		}
		if err := os.MkdirAll(syncDir, 0755); err != nil {
			log.Printf("Warning: failed to create local_sync_dir: %v\n", err)
		} else {
			log.Printf("Local sync folder enabled: %s\n", syncDir)
		}
	}

	// API Handlers
	http.HandleFunc("/api/sync/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"enabled": cfg.LocalSyncDir != "",
			"dir":     syncDir,
		})
	})

	http.HandleFunc("/api/sync/files", func(w http.ResponseWriter, r *http.Request) {
		if cfg.LocalSyncDir == "" {
			http.Error(w, "Local sync is disabled", http.StatusForbidden)
			return
		}
		entries, err := os.ReadDir(syncDir)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		var files []string
		for _, entry := range entries {
			if !entry.IsDir() {
				name := entry.Name()
				ext := strings.ToLower(filepath.Ext(name))
				if ext == ".md" || ext == ".markdown" || ext == ".txt" {
					files = append(files, name)
				}
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	})

	http.HandleFunc("/api/sync/file", func(w http.ResponseWriter, r *http.Request) {
		if cfg.LocalSyncDir == "" {
			http.Error(w, "Local sync is disabled", http.StatusForbidden)
			return
		}

		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "Missing file name", http.StatusBadRequest)
			return
		}

		// Prevent directory traversal
		safeName := filepath.Base(name)
		filePath := filepath.Join(syncDir, safeName)

		if r.Method == http.MethodGet {
			content, err := os.ReadFile(filePath)
			if os.IsNotExist(err) {
				http.Error(w, "File not found", http.StatusNotFound)
				return
			} else if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
			w.Write(content)
		} else if r.Method == http.MethodPost {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			err = os.WriteFile(filePath, body, 0644)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Saved successfully"))
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Static files server setup
	distFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		log.Fatalf("Failed to load embedded files: %v", err)
	}

	var handler http.Handler = http.FileServer(http.FS(distFS))
	if cfg.EnableGzip {
		handler = makeGzipHandler(handler)
	}
	http.Handle("/", handler)

	// Address formatting
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	log.Printf("WASM Markdown Editor serving at http://%s ...\n", address)

	// Automatically open the browser
	if cfg.AutoOpen {
		go func() {
			// Delay slightly to ensure server is listening
			time.Sleep(200 * time.Millisecond)
			url := fmt.Sprintf("http://localhost:%d", cfg.Port)
			if cfg.Host != "127.0.0.1" && cfg.Host != "0.0.0.0" {
				url = fmt.Sprintf("http://%s:%d", cfg.Host, cfg.Port)
			}
			log.Printf("Automatically launching default browser at %s\n", url)
			openBrowser(url)
		}()
	}

	if err := http.ListenAndServe(address, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
