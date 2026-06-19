package main

import (
	"bytes"
	"syscall/js"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// Initialize goldmark parser with GFM and HTML rendering enabled
var md = goldmark.New(
	goldmark.WithExtensions(
		extension.GFM, // Tables, TaskLists, Strikethrough, Linkify
	),
	goldmark.WithParserOptions(
		parser.WithAttribute(), // Custom attributes
	),
	goldmark.WithRendererOptions(
		html.WithUnsafe(), // Allow raw HTML rendering
	),
)

// parseMarkdownJS exposes the Markdown parser to JavaScript
func parseMarkdownJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	markdownText := args[0].String()

	var buf bytes.Buffer
	if err := md.Convert([]byte(markdownText), &buf); err != nil {
		return "Error parsing markdown: " + err.Error()
	}

	return buf.String()
}

func main() {
	// Expose the parseMarkdown function to JavaScript
	js.Global().Set("parseMarkdown", js.FuncOf(parseMarkdownJS))

	// Block the main goroutine to keep the WASM instance alive
	select {}
}
