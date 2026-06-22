//go:build js && wasm

package main

import (
	"syscall/js"
)

// parseMarkdownJS exposes the Markdown parser to JavaScript
func parseMarkdownJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	markdownText := args[0].String()
	return parseMarkdown(markdownText)
}

// convertHtmlToMarkdownJS exposes the HTML to Markdown parser to JavaScript
func convertHtmlToMarkdownJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	htmlText := args[0].String()
	return convertHtmlToMarkdown(htmlText)
}

func main() {
	// Expose Markdown-to-HTML parser to JavaScript
	js.Global().Set("parseMarkdown", js.FuncOf(parseMarkdownJS))

	// Expose HTML-to-Markdown parser to JavaScript
	js.Global().Set("convertHtmlToMarkdown", js.FuncOf(convertHtmlToMarkdownJS))

	// Block the main goroutine to keep the WASM instance alive
	select {}
}
