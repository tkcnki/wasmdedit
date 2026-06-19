/* ==========================================================================
   WasmDEdit Application Logic
   ========================================================================== */

// --- Global Constants & State ---
let wasmReady = false;
let currentFilename = 'untitled.md';
let syncScrollEnabled = true;
let isScrollingEditor = false;
let isScrollingPreview = false;
let debounceTimer;

// DOM Elements
const textarea = document.getElementById('markdown-textarea');
const previewOutput = document.getElementById('preview-output');
const previewContainer = document.getElementById('preview-container');
const statusWasm = document.getElementById('status-wasm');
const filenameDisplay = document.getElementById('filename-display');
const linesCounter = document.getElementById('counter-lines');
const wordsCounter = document.getElementById('counter-words');
const sidebar = document.getElementById('sidebar-templates');
const workspaceLayout = document.getElementById('workspace-layout');

// --- Initial Markdown Template ---
const welcomeMarkdown = `# 🚀 WasmDEdit へようこそ！

Goの**WebAssembly (WASM)**と**Mermaid**を組み合わせた、高速でモダンなMarkdownエディタです。
編集内容はブラウザの \`LocalStorage\` に**自動保存**されます。

## ✨ 主な機能

1. **Go WASM による超高速パース**:
   GitHub Flavored Markdown (GFM) に対応した \`goldmark\` パーサーがブラウザ上で動作します。
2. **Mermaid図表の統合**:
   シーケンス図、フローチャート、ガントチャートなどをリアルタイムにプレビューに描画します。
3. **シンクロスクロール**:
   エディタ側のスクロールに合わせて、プレビュー側が自動的にスクロールします。
4. **エクスポート機能**:
   Raw Markdown (\`.md\`)、スタイルが同梱された完全な HTML (\`.html\`)、および PDF印刷 に対応。

---

## 📊 GFM機能のテスト

### 1. テーブル

| 機能 | 技術スタック | WASM / JS | 状態 |
| :--- | :--- | :---: | :---: |
| Markdownパース | Go / goldmark | WASM | ✅ 動作中 |
| 図表レンダリング | Mermaid.js | JS | ✅ 動作中 |
| シンタックスハイライト | Prism.js | JS | ✅ 動作中 |

### 2. タスクリスト

- [x] WebAssemblyモジュールを作成する
- [x] Mermaid.jsのレンダリングエンジンを統合する
- [ ] クラウド同期機能の実装（予定）

### 3. コードブロック (Prism.js によるハイライト)

\`\`\`go
package main

import "fmt"

func main() {
    fmt.Println("Hello, WebAssembly World!")
}
\`\`\`

---

## 🎨 Mermaid ダイアグラムの例

\`\`\`mermaid
graph TD
    A[ユーザーの入力] -->|タイピング| B(デバウンス処理)
    B -->|300ms待機| C{パース要求}
    C -->|Go WASM| D[HTML生成]
    C -->|Mermaid.js| E[SVG図表生成]
    D --> F[プレビュー表示]
    E --> F
\`\`\`

左側の「**図表挿入**」メニューからテンプレートを選択すると、いつでも様々なMermaidのダイアグラムを追加できます。
`;

// --- Mermaid Templates Data ---
const templates = {
    'flowchart': `\`\`\`mermaid
graph TD
    A[開始] --> B{条件分岐}
    B -- Yes --> C[処理A]
    B -- No --> D[処理B]
    C --> E[終了]
    D --> E
\`\`\`\n`,
    'sequence': `\`\`\`mermaid
sequenceDiagram
    autonumber
    ユーザー->>エディタ: テキスト入力
    エディタ->>WASM: パース要求
    WASM-->>エディタ: HTML返却
    エディタ->>Mermaid: 描画要求
    Mermaid-->>エディタ: SVGを描画
\`\`\`\n`,
    'class-diagram': `\`\`\`mermaid
classDiagram
    class Document {
        +String filename
        +String content
        +save() void
        +exportHTML() String
    }
    class Editor {
        +textarea element
        +preview element
        +render() void
    }
    Editor --> Document
\`\`\`\n`,
    'state': `\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Editing : キー入力
    Editing --> Parsing : 300ms待機 (Debounce)
    Parsing --> Rendering : パース完了
    Rendering --> Idle : 描画成功
    Rendering --> ErrorState : 描画失敗
    ErrorState --> Editing : 修正入力
\`\`\`\n`,
    'gantt': `\`\`\`mermaid
gantt
    title プロジェクト開発スケジュール
    dateFormat  YYYY-MM-DD
    section 設計
    要件定義         :active, des1, 2026-06-20, 2d
    システム設計     :des2, after des1, 3d
    section 実装
    WASMモジュール実装:imp1, 2026-06-25, 4d
    フロントUI構築   :imp2, after imp1, 4d
\`\`\`\n`,
    'git-graph': `\`\`\`mermaid
gitGraph
    commit
    commit
    branch feature-wasm
    checkout feature-wasm
    commit
    commit
    checkout main
    merge feature-wasm
    commit
\`\`\`\n`,
    'pie-chart': `\`\`\`mermaid
pie title エディタ構成ファイルの比率
    "HTML / CSS" : 25
    "JavaScript" : 45
    "Go (WASM)" : 30
\`\`\`\n`,
    'mindmap': `\`\`\`mermaid
mindmap
  root((WasmDEdit))
    Go WASM
      goldmark
      syscall/js
    フロントエンド
      HTML5
      CSS3 (ダーク/ライト)
      Vanilla JS
    外部ツール
      Mermaid.js
      Prism.js
      FontAwesome
\`\`\`\n`,
    'er-diagram': `\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
\`\`\`\n`,
    'user-journey': `\`\`\`mermaid
journey
    title ドキュメント作成ジャーニー
    section エディタ起動
      サイト表示: 5: ユーザー
      WASMの読み込み: 4: エディタ, Go
    section 執筆
      Markdown入力: 5: ユーザー
      Mermaid挿入: 5: ユーザー, エディタ
      リアルタイム確認: 4: ユーザー
    section 保存
      ローカル保存: 5: エディタ
      PDF出力: 4: ユーザー
\`\`\`\n`
};

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Mermaid
    initMermaid();

    // 2. Load WebAssembly
    const loaded = await loadWasm();
    if (loaded) {
        wasmReady = true;
        // Restore from LocalStorage or Load Welcome markdown
        const savedMarkdown = localStorage.getItem('wasmdedit_markdown');
        const savedFilename = localStorage.getItem('wasmdedit_filename');
        
        if (savedMarkdown !== null) {
            textarea.value = savedMarkdown;
            if (savedFilename) currentFilename = savedFilename;
        } else {
            textarea.value = welcomeMarkdown;
        }
        
        updateFilenameDisplay();
        updateMetadata();
        renderMarkdown();
    }
    
    // 3. Register Event Listeners
    setupEventListeners();
});

// --- WebAssembly Loader ---
async function loadWasm() {
    try {
        const go = new Go();
        let result;
        if (WebAssembly.instantiateStreaming) {
            result = await WebAssembly.instantiateStreaming(fetch("main.wasm"), go.importObject);
        } else {
            const response = await fetch("main.wasm");
            const bytes = await response.arrayBuffer();
            result = await WebAssembly.instantiate(bytes, go.importObject);
        }
        go.run(result.instance);
        
        statusWasm.innerHTML = '<i class="fa-solid fa-circle-check"></i> WASM: 準備完了';
        statusWasm.className = 'status-badge ready';
        return true;
    } catch (err) {
        console.error("WebAssembly initialization failed:", err);
        statusWasm.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> WASM: ロード失敗';
        statusWasm.className = 'status-badge error';
        return false;
    }
}

// --- Mermaid Configuration ---
function initMermaid() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true }
    });
}

// --- Markdown Renderer ---
function renderMarkdown() {
    if (!wasmReady) return;
    
    const markdownText = textarea.value;
    
    // Call the Go WASM function to parse Markdown to HTML
    const htmlOutput = window.parseMarkdown(markdownText);
    
    // Insert HTML into preview
    previewOutput.innerHTML = htmlOutput;
    
    // Trigger Prism.js syntax highlighting for standard code blocks
    Prism.highlightAllUnder(previewOutput);
    
    // Asynchronously render Mermaid diagrams
    renderMermaidDiagrams();
    
    // Autosave
    localStorage.setItem('wasmdedit_markdown', markdownText);
}

// --- Mermaid Render Engine ---
async function renderMermaidDiagrams() {
    // Find all markdown code blocks generated for mermaid
    const mermaidCodes = previewOutput.querySelectorAll('pre code.language-mermaid');
    
    for (let i = 0; i < mermaidCodes.length; i++) {
        const codeElement = mermaidCodes[i];
        const preElement = codeElement.parentElement;
        const rawCode = codeElement.textContent.trim();
        
        // Create container wrapper for style and isolation
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        
        // Unique ID for SVG generation
        const renderId = `mermaid-render-${Date.now()}-${i}`;
        
        try {
            // Render Mermaid to SVG text
            const { svg } = await mermaid.render(renderId, rawCode);
            container.innerHTML = svg;
        } catch (err) {
            console.error("Mermaid Render Error:", err);
            
            // Format error box
            const errorElement = document.createElement('div');
            errorElement.className = 'mermaid-error';
            errorElement.textContent = `Mermaid 構文エラー:\n${err.message || err}`;
            container.appendChild(errorElement);
            
            // Recover mermaid core parser from crash
            initMermaid();
        }
        
        // Replace the raw <pre> block with the rendered container
        if (preElement.parentNode) {
            preElement.replaceWith(container);
        }
    }
}

// --- Debounce Helper ---
function debounceRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        renderMarkdown();
        updateMetadata();
    }, 300);
}

// --- Stats & Line Counters ---
function updateMetadata() {
    const text = textarea.value;
    
    // Line count
    const lines = text.split('\n').length;
    linesCounter.textContent = `行数: ${lines}`;
    
    // Character count (excluding newlines for accuracy in JP)
    const chars = text.replace(/\n/g, '').length;
    wordsCounter.textContent = `文字数: ${chars}`;
}

// --- Sync Scrolling System ---
function setupSyncScroll() {
    textarea.addEventListener('scroll', () => {
        if (!syncScrollEnabled || isScrollingPreview) return;
        isScrollingEditor = true;
        
        const scrollPct = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
        previewContainer.scrollTop = scrollPct * (previewContainer.scrollHeight - previewContainer.clientHeight);
        
        setTimeout(() => { isScrollingEditor = false; }, 50);
    });

    previewContainer.addEventListener('scroll', () => {
        if (!syncScrollEnabled || isScrollingEditor) return;
        isScrollingPreview = true;
        
        const scrollPct = previewContainer.scrollTop / (previewContainer.scrollHeight - previewContainer.clientHeight);
        textarea.scrollTop = scrollPct * (textarea.scrollHeight - textarea.clientHeight);
        
        setTimeout(() => { isScrollingPreview = false; }, 50);
    });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Input monitoring
    textarea.addEventListener('input', debounceRender);
    
    // Sync scroll setup
    setupSyncScroll();
    
    // Toolbar Buttons
    document.getElementById('btn-new').addEventListener('click', fileNew);
    document.getElementById('btn-open').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', fileOpen);
    document.getElementById('btn-save').addEventListener('click', fileSave);
    document.getElementById('btn-export-html').addEventListener('click', exportToHTML);
    document.getElementById('btn-export-pdf').addEventListener('click', () => window.print());
    
    // Theme Toggle
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    
    // Sidebar Control
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        btnToggleSidebar.classList.toggle('active');
    });
    
    // Clean Text Button
    document.getElementById('btn-clear-text').addEventListener('click', () => {
        if (confirm("テキストをすべてクリアしますか？")) {
            textarea.value = '';
            textarea.focus();
            debounceRender();
        }
    });

    // Scroll Sync toggle
    const btnSyncScroll = document.getElementById('btn-sync-scroll-toggle');
    btnSyncScroll.addEventListener('click', () => {
        syncScrollEnabled = !syncScrollEnabled;
        btnSyncScroll.classList.toggle('active');
    });
    
    // Responsive view buttons
    const btnViewEditor = document.getElementById('btn-view-editor');
    const btnViewSplit = document.getElementById('btn-view-split');
    const btnViewPreview = document.getElementById('btn-view-preview');
    
    btnViewEditor.addEventListener('click', () => {
        setViewLayout('view-editor');
        setActiveViewButton(btnViewEditor);
    });
    
    btnViewSplit.addEventListener('click', () => {
        setViewLayout('view-split');
        setActiveViewButton(btnViewSplit);
    });
    
    btnViewPreview.addEventListener('click', () => {
        setViewLayout('view-preview');
        setActiveViewButton(btnViewPreview);
    });
    
    // Mermaid Template Insertion
    document.querySelectorAll('.tpl-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const templateKey = button.getAttribute('data-template');
            const templateText = templates[templateKey];
            if (templateText) {
                insertTextAtCursor(templateText);
            }
        });
    });
    
    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            fileSave();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            document.getElementById('file-input').click();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            fileNew();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            window.print();
        }
    });
    
    // Tab key and auto-indent hooks inside Textarea
    textarea.addEventListener('keydown', handleTextareaKeydown);
}

// --- Textarea Editing Helpers ---
function handleTextareaKeydown(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        insertTextAtCursor('    '); // 4 spaces for Tab
    }
    
    if (e.key === 'Enter') {
        // Auto-indentation helper
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPosition);
        const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
        const lastLine = textBeforeCursor.substring(lastLineStart);
        
        // Find leading spaces or tabs
        const match = lastLine.match(/^([ \t]+)/);
        if (match) {
            e.preventDefault();
            const indent = match[1];
            insertTextAtCursor('\n' + indent);
        }
    }
}

function insertTextAtCursor(text) {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const originalText = textarea.value;
    
    textarea.value = originalText.substring(0, startPos) + text + originalText.substring(endPos);
    
    // Reposition cursor after the inserted text
    const newCursorPos = startPos + text.length;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;
    textarea.focus();
    
    debounceRender();
}

// --- File Operations ---
function fileNew() {
    if (confirm("新規作成しますか？現在のデータは上書き保存されていない場合失われます。")) {
        textarea.value = welcomeMarkdown;
        currentFilename = 'untitled.md';
        updateFilenameDisplay();
        debounceRender();
    }
}

function fileOpen(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        textarea.value = event.target.result;
        currentFilename = file.name;
        updateFilenameDisplay();
        debounceRender();
        
        // Reset file input value to allow opening same file again
        e.target.value = '';
    };
    reader.readAsText(file);
}

function fileSave() {
    const blob = new Blob([textarea.value], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = currentFilename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function updateFilenameDisplay() {
    filenameDisplay.innerHTML = `<i class="fa-regular fa-file"></i> ${currentFilename}`;
    localStorage.setItem('wasmdedit_filename', currentFilename);
}

// --- Theme Management ---
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('wasmdedit_theme', newTheme);
    
    // Swap Prism.js stylesheet theme
    const prismThemeLink = document.getElementById('prism-theme');
    if (newTheme === 'dark') {
        prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
    } else {
        prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
    }
    
    // Re-initialize Mermaid with the appropriate theme
    initMermaid();
    
    // Force re-render of diagrams to apply the new theme
    if (wasmReady) {
        renderMarkdown();
    }
}

// Ensure theme is preserved from local storage on reload
(function() {
    const savedTheme = localStorage.getItem('wasmdedit_theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        const prismThemeLink = document.getElementById('prism-theme');
        if (savedTheme === 'dark') {
            prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
        } else {
            prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
        }
    }
})();

// --- Layout Toggles ---
function setViewLayout(layoutClass) {
    workspaceLayout.className = 'workspace-panels';
    if (layoutClass !== 'view-split') {
        workspaceLayout.classList.add(layoutClass);
    }
}

function setActiveViewButton(activeBtn) {
    document.querySelectorAll('.view-toggle-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

// --- Export to HTML (Self-contained Page) ---
async function exportToHTML() {
    // Generate styled HTML page with content
    const parsedHtml = previewOutput.innerHTML;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const activeTheme = isDark ? 'dark' : 'light';
    
    const prismThemeUrl = isDark 
        ? "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";

    // Build the standalone HTML document
    const htmlDocString = `<!DOCTYPE html>
<html lang="ja" data-theme="${activeTheme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentFilename.replace('.md', '')} - Exported by WasmDEdit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${prismThemeUrl}">
    <style>
        :root[data-theme="dark"] {
            --bg: #0e0f12;
            --panel: #14161d;
            --text: #e2e8f0;
            --border: #262936;
            --primary: #38bdf8;
            --code-bg: #1a1c23;
        }
        :root[data-theme="light"] {
            --bg: #ffffff;
            --panel: #ffffff;
            --text: #0f172a;
            --border: #cbd5e1;
            --primary: #0284c7;
            --code-bg: #f8fafc;
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 2rem max(2rem, (100vw - 800px) / 2);
            line-height: 1.7;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }
        .markdown-body h1 { font-size: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
        .markdown-body h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
        .markdown-body blockquote {
            padding: 0.5rem 1rem;
            color: var(--text);
            border-left: 0.25rem solid var(--border);
            background-color: var(--code-bg);
            opacity: 0.8;
            font-style: italic;
            border-radius: 0 6px 6px 0;
            margin-bottom: 1rem;
        }
        .markdown-body pre {
            padding: 1rem;
            overflow: auto;
            background-color: var(--code-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        .markdown-body code {
            padding: 0.2em 0.4em;
            font-size: 85%;
            background-color: var(--code-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
        }
        .markdown-body pre code {
            padding: 0;
            background-color: transparent;
            border: none;
        }
        .mermaid-container {
            display: flex;
            justify-content: center;
            background-color: var(--code-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        .mermaid-container svg {
            max-width: 100%;
        }
        table {
            border-spacing: 0;
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 1rem;
        }
        table th, table td {
            padding: 6px 13px;
            border: 1px solid var(--border);
        }
        table th { background-color: var(--code-bg); }
        table tr:nth-child(2n) { background-color: var(--code-bg); }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <article class="markdown-body">
        ${parsedHtml}
    </article>
</body>
</html>`;

    // Download the file
    const blob = new Blob([htmlDocString], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = currentFilename.replace('.md', '.html');
    link.click();
    URL.revokeObjectURL(link.href);
}
