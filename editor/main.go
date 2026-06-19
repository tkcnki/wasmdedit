package main

import (
	"bytes"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
	nethtml "golang.org/x/net/html"
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

// --- HTML to Markdown Parser Logic ---

type listState struct {
	isOrdered bool
	index     int
}

func getAttr(n *nethtml.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func hasClass(n *nethtml.Node, className string) bool {
	classVal := getAttr(n, "class")
	classes := strings.Fields(classVal)
	for _, c := range classes {
		if c == className {
			return true
		}
	}
	return false
}

func textContent(n *nethtml.Node) string {
	var buf bytes.Buffer
	var f func(*nethtml.Node)
	f = func(node *nethtml.Node) {
		if node.Type == nethtml.TextNode {
			buf.WriteString(node.Data)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(n)
	return buf.String()
}

func findChild(n *nethtml.Node, tag string) *nethtml.Node {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == nethtml.ElementNode && c.Data == tag {
			return c
		}
		if found := findChild(c, tag); found != nil {
			return found
		}
	}
	return nil
}

func hasAttribute(n *nethtml.Node, key string) bool {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return true
		}
	}
	return false
}

func renderTable(tableNode *nethtml.Node, buf *bytes.Buffer) {
	var rows [][]string
	var findRows func(*nethtml.Node)
	findRows = func(node *nethtml.Node) {
		if node.Type == nethtml.ElementNode && node.Data == "tr" {
			var cols []string
			for c := node.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == nethtml.ElementNode && (c.Data == "td" || c.Data == "th") {
					cols = append(cols, strings.TrimSpace(textContent(c)))
				}
			}
			if len(cols) > 0 {
				rows = append(rows, cols)
			}
			return
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			findRows(c)
		}
	}
	findRows(tableNode)

	if len(rows) == 0 {
		return
	}

	for i, row := range rows {
		buf.WriteString("| " + strings.Join(row, " | ") + " |\n")
		if i == 0 {
			var separators []string
			for range row {
				separators = append(separators, "---")
			}
			buf.WriteString("| " + strings.Join(separators, " | ") + " |\n")
		}
	}
}

func renderNodes(n *nethtml.Node, buf *bytes.Buffer, listStack []listState, inPre bool) {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		renderNode(c, buf, listStack, inPre)
	}
}

func renderNode(n *nethtml.Node, buf *bytes.Buffer, listStack []listState, inPre bool) {
	if n.Type == nethtml.TextNode {
		text := n.Data
		if !inPre {
			// Collapse excess HTML whitespaces to a single space
			if strings.TrimSpace(text) == "" {
				buf.WriteString(" ")
				return
			}
			text = strings.ReplaceAll(text, "\n", " ")
			for strings.Contains(text, "  ") {
				text = strings.ReplaceAll(text, "  ", " ")
			}
		}
		buf.WriteString(text)
		return
	}

	if n.Type != nethtml.ElementNode {
		return
	}

	switch n.Data {
	case "h1", "h2", "h3", "h4", "h5", "h6":
		level := int(n.Data[1] - '0')
		buf.WriteString("\n\n" + strings.Repeat("#", level) + " ")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("\n\n")

	case "p":
		buf.WriteString("\n\n")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("\n\n")

	case "br":
		buf.WriteString("  \n")

	case "strong", "b":
		buf.WriteString("**")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("**")

	case "em", "i":
		buf.WriteString("*")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("*")

	case "del", "s", "strike":
		buf.WriteString("~~")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("~~")

	case "code":
		if inPre {
			renderNodes(n, buf, listStack, inPre)
		} else {
			buf.WriteString("`")
			buf.WriteString(textContent(n))
			buf.WriteString("`")
		}

	case "pre":
		codeNode := findChild(n, "code")
		lang := ""
		if codeNode != nil {
			classVal := getAttr(codeNode, "class")
			if strings.HasPrefix(classVal, "language-") {
				lang = strings.TrimPrefix(classVal, "language-")
			}
		} else {
			lang = getAttr(n, "data-lang")
		}

		buf.WriteString("\n\n```" + lang + "\n")
		if codeNode != nil {
			buf.WriteString(strings.TrimSpace(textContent(codeNode)))
		} else {
			buf.WriteString(strings.TrimSpace(textContent(n)))
		}
		buf.WriteString("\n```\n\n")

	case "div":
		if hasClass(n, "mermaid-container") {
			mermaidCode := getAttr(n, "data-mermaid-code")
			mermaidCode = nethtml.UnescapeString(mermaidCode)
			buf.WriteString("\n\n```mermaid\n" + strings.TrimSpace(mermaidCode) + "\n```\n\n")
		} else {
			renderNodes(n, buf, listStack, inPre)
		}

	case "ul":
		buf.WriteString("\n")
		renderNodes(n, buf, append(listStack, listState{isOrdered: false}), inPre)
		buf.WriteString("\n")

	case "ol":
		buf.WriteString("\n")
		renderNodes(n, buf, append(listStack, listState{isOrdered: true, index: 1}), inPre)
		buf.WriteString("\n")

	case "li":
		depth := len(listStack)
		indent := strings.Repeat("    ", depth-1)
		prefix := "- "
		
		if depth > 0 {
			state := &listStack[depth-1]
			if state.isOrdered {
				prefix = fmt.Sprintf("%d. ", state.index)
				state.index++
			}
		}

		buf.WriteString("\n" + indent + prefix)

		checkbox := findChild(n, "input")
		if checkbox != nil && getAttr(checkbox, "type") == "checkbox" {
			isChecked := getAttr(checkbox, "checked") != "" || hasAttribute(checkbox, "checked")
			if isChecked {
				buf.WriteString("[x] ")
			} else {
				buf.WriteString("[ ] ")
			}
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c != checkbox {
					renderNode(c, buf, listStack, inPre)
				}
			}
		} else {
			renderNodes(n, buf, listStack, inPre)
		}
		buf.WriteString("\n")

	case "a":
		href := getAttr(n, "href")
		buf.WriteString("[")
		renderNodes(n, buf, listStack, inPre)
		buf.WriteString("](" + href + ")")

	case "img":
		src := getAttr(n, "src")
		alt := getAttr(n, "alt")
		buf.WriteString("![" + alt + "](" + src + ")")

	case "table":
		buf.WriteString("\n")
		renderTable(n, buf)
		buf.WriteString("\n")

	default:
		renderNodes(n, buf, listStack, inPre)
	}
}

func cleanMarkdown(md string) string {
	lines := strings.Split(md, "\n")
	var result []string
	consecutiveEmpty := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			consecutiveEmpty++
			if consecutiveEmpty <= 1 {
				result = append(result, "")
			}
		} else {
			consecutiveEmpty = 0
			result = append(result, strings.TrimRight(line, " \t"))
		}
	}
	return strings.TrimSpace(strings.Join(result, "\n"))
}

func convertHtmlToMarkdownJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	htmlText := args[0].String()

	doc, err := nethtml.Parse(strings.NewReader(htmlText))
	if err != nil {
		return "Error parsing HTML: " + err.Error()
	}

	var buf bytes.Buffer
	var body *nethtml.Node
	var findBody func(*nethtml.Node)
	findBody = func(node *nethtml.Node) {
		if node.Type == nethtml.ElementNode && node.Data == "body" {
			body = node
			return
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			findBody(c)
		}
	}
	findBody(doc)

	if body != nil {
		renderNodes(body, &buf, nil, false)
	} else {
		renderNodes(doc, &buf, nil, false)
	}

	return cleanMarkdown(buf.String())
}

func main() {
	// Expose Markdown-to-HTML parser to JavaScript
	js.Global().Set("parseMarkdown", js.FuncOf(parseMarkdownJS))

	// Expose HTML-to-Markdown parser to JavaScript
	js.Global().Set("convertHtmlToMarkdown", js.FuncOf(convertHtmlToMarkdownJS))

	// Block the main goroutine to keep the WASM instance alive
	select {}
}
