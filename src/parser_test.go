package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
	nethtml "golang.org/x/net/html"
)

func runHTMLToMarkdown(htmlText string) string {
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

func TestListConversion(t *testing.T) {
	var mdParser = goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(parser.WithAttribute()),
		goldmark.WithRendererOptions(html.WithUnsafe()),
	)

	inputMarkdown := `1. **Go WASM による超高速パース**:
   GitHub Flavored Markdown (GFM) に対応した ` + "`goldmark`" + ` パーサーがブラウザ上で動作します。`

	var htmlBuf bytes.Buffer
	if err := mdParser.Convert([]byte(inputMarkdown), &htmlBuf); err != nil {
		t.Fatalf("failed to convert markdown to html: %v", err)
	}

	htmlStr := htmlBuf.String()
	t.Logf("Generated HTML:\n%s", htmlStr)

	convertedMarkdown := runHTMLToMarkdown(htmlStr)
	t.Logf("Converted Markdown:\n%s", convertedMarkdown)

	if strings.Contains(convertedMarkdown, "1.\n\n") || strings.Contains(convertedMarkdown, "1.\n") {
		t.Errorf("List was broken. Converted markdown was:\n%s", convertedMarkdown)
	}
}

func TestListParagraphsAndBlocks(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "list item containing single paragraph",
			html: `<ol><li><p>Item 1</p></li></ol>`,
			want: "1. Item 1",
		},
		{
			name: "list item containing multiple paragraphs",
			html: `<ol><li><p>First paragraph</p><p>Second paragraph</p></li></ol>`,
			want: "1. First paragraph\n\n    Second paragraph",
		},
		{
			name: "list item containing code block",
			html: `<ol><li>Item 1<pre><code class="language-go">func main() {
}</code></pre></li></ol>`,
			want: "1. Item 1\n\n    ```go\n    func main() {\n    }\n    ```",
		},
		{
			name: "nested ordered and unordered lists",
			html: `<ul><li>Item 1<ol><li>Sub-item 1</li></ol></li></ul>`,
			want: "- Item 1\n    1. Sub-item 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := runHTMLToMarkdown(tt.html)
			gotNormalized := strings.ReplaceAll(strings.TrimSpace(got), "\r\n", "\n")
			wantNormalized := strings.ReplaceAll(strings.TrimSpace(tt.want), "\r\n", "\n")
			if gotNormalized != wantNormalized {
				t.Errorf("runHTMLToMarkdown() = %q, want %q", gotNormalized, wantNormalized)
			}
		})
	}
}

func TestMultiStepConversion(t *testing.T) {
	var mdParser = goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(parser.WithAttribute()),
		goldmark.WithRendererOptions(html.WithUnsafe()),
	)

	inputMarkdown := `1. **Go WASM による超高速パース**:
   GitHub Flavored Markdown (GFM) に対応した ` + "`goldmark`" + ` パーサーがブラウザ上で動作します。
2. **ビジュアル（WYSIWYG）モード**:
   「**ビジュアル**」タブに切り替えることで、レンダリング画面上で直接文字入力や装飾が行えます。`

	currentMarkdown := inputMarkdown

	for i := 1; i <= 3; i++ {
		var htmlBuf bytes.Buffer
		if err := mdParser.Convert([]byte(currentMarkdown), &htmlBuf); err != nil {
			t.Fatalf("failed to convert markdown to html at step %d: %v", i, err)
		}
		htmlStr := htmlBuf.String()
		currentMarkdown = runHTMLToMarkdown(htmlStr)
	}

	// The output should be a clean list without separated numbers or extra blank lines
	lines := strings.Split(currentMarkdown, "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "1." || strings.TrimSpace(line) == "2." {
			t.Errorf("List numbers got separated by blank line in output: %q", currentMarkdown)
		}
	}
}
