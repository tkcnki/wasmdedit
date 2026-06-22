/* ==========================================================================
   WasmDEdit Application Logic (Bidirectional WYSIWYG Edition)
   ========================================================================== */

// --- Global Constants & State ---
let wasmReady = false;
let currentFilename = 'untitled.md';
let syncScrollEnabled = true;
let isScrollingEditor = false;
let isScrollingPreview = false;
let debounceTimer;

// Mode state: 'source' (Markdown text) or 'visual' (WYSIWYG contenteditable)
let currentMode = 'source'; 

// Modal editing state
let activeEditingElement = null;
let activeEditingType = null;

// Table editing state
let activeTableCell = null;

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
const editorModal = document.getElementById('editor-modal');
const modalTextarea = document.getElementById('modal-textarea');
const modalTitle = document.getElementById('modal-title');

// --- Initial Markdown Template ---
const welcomeMarkdown = `# 🚀 WasmDEdit へようこそ！

Goの**WebAssembly (WASM)**と**Mermaid**を組み合わせた、高速でモダンなMarkdownエディタです。
編集内容はブラウザの \`LocalStorage\` に**自動保存**されます。

## ✨ 主な機能

1. **Go WASM による超高速パース**:
   GitHub Flavored Markdown (GFM) に対応した \`goldmark\` パーサーがブラウザ上で動作します。
2. **ビジュアル（WYSIWYG）モード**:
   「**ビジュアル**」タブに切り替えることで、レンダリング画面上で直接文字入力や装飾が行えます。
3. **Mermaid図表の統合**:
   シーケンス図、フローチャート、ガントチャートなどをリアルタイムにプレビューに描画します。ビジュアルモード中も、図にホバーして「Mermaid編集」ボタンを押すことで安全に編集できます。
4. **シンクロスクロール**:
   エディタ側のスクロールに合わせて、プレビュー側が自動的にスクロールします。
5. **エクスポート機能**:
   Raw Markdown (\`.md\`)、スタイルが同梱された完全な HTML (\`.html\`)、および PDF印刷 に対応。

---

## 📊 GFM機能のテスト

| 機能 | 技術スタック | WASM / JS | 状態 |
| :--- | :--- | :---: | :---: |
| Markdownパース | Go / goldmark | WASM | ✅ 動作中 |
| 図表レンダリング | Mermaid.js | JS | ✅ 動作中 |
| シンタックスハイライト | Prism.js | JS | ✅ 動作中 |

- [x] WebAssemblyモジュールを作成する
- [x] Mermaid.jsのレンダリングエンジンを統合する
- [x] 双方向WYSIWYG編集機能を実装する

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
        const savedMode = localStorage.getItem('wasmdedit_mode');
        
        if (savedMarkdown !== null) {
            textarea.value = savedMarkdown;
            if (savedFilename) currentFilename = savedFilename;
        } else {
            textarea.value = welcomeMarkdown;
        }
        
        updateFilenameDisplay();
        updateMetadata();
        
        // Initial parse
        renderMarkdown();
        
        // Restore Mode
        if (savedMode && savedMode === 'visual') {
            toggleMode('visual');
        } else {
            toggleMode('source');
        }
    }
    
    // 3. Register Event Listeners
    setupEventListeners();
    
    // 4. Setup Drag and Drop File Handling
    setupDragAndDrop();

    // 5. Setup Local Sync Folder (if enabled)
    initLocalSync();
});

// --- WebAssembly Loader ---
async function loadWasm() {
    try {
        const go = new Go();
        let result;
        
        const fetchAndInstantiate = async () => {
            const response = await fetch("main.wasm");
            if (!response.ok) {
                throw new Error(`Failed to fetch main.wasm: status ${response.status} ${response.statusText}`);
            }
            const bytes = await response.arrayBuffer();
            return await WebAssembly.instantiate(bytes, go.importObject);
        };

        if (WebAssembly.instantiateStreaming) {
            try {
                result = await WebAssembly.instantiateStreaming(fetch("main.wasm"), go.importObject);
            } catch (err) {
                console.warn("WebAssembly.instantiateStreaming failed, trying fallback:", err);
                result = await fetchAndInstantiate();
            }
        } else {
            result = await fetchAndInstantiate();
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

// --- Markdown Renderer (Source -> HTML) ---
function renderMarkdown() {
    if (!wasmReady) return Promise.resolve();
    
    const markdownText = textarea.value;
    
    // Call the Go WASM function to parse Markdown to HTML
    const htmlOutput = window.parseMarkdown(markdownText);
    
    // Insert HTML into preview
    previewOutput.innerHTML = htmlOutput;
    resolveLocalDBFiles(previewOutput);
    
    // Save raw codes for code blocks before Prism mutates the DOM
    previewOutput.querySelectorAll('pre code').forEach(codeEl => {
        const preEl = codeEl.parentElement;
        if (!preEl.hasAttribute('data-raw-code')) {
            preEl.setAttribute('data-raw-code', codeEl.textContent);
        }
    });
    
    // Trigger Prism.js syntax highlighting for standard code blocks
    Prism.highlightAllUnder(previewOutput);
    
    // Asynchronously render Mermaid diagrams
    const mermaidPromise = renderMermaidDiagrams();
    
    // Autosave Markdown source
    localStorage.setItem('wasmdedit_markdown', markdownText);
    
    return mermaidPromise;
}

// --- Mermaid Zoom & Pan Functions ---
function applyZoomPanToMermaid(container, svgMarkup) {
    container.innerHTML = '';
    
    const viewport = document.createElement('div');
    viewport.className = 'mermaid-viewport';
    viewport.innerHTML = svgMarkup;
    container.appendChild(viewport);
    
    const controls = document.createElement('div');
    controls.className = 'mermaid-zoom-controls';
    controls.setAttribute('contenteditable', 'false');
    controls.innerHTML = `
        <button class="zoom-btn zoom-in" title="拡大" type="button"><i class="fa-solid fa-plus"></i></button>
        <button class="zoom-btn zoom-out" title="縮小" type="button"><i class="fa-solid fa-minus"></i></button>
        <button class="zoom-btn zoom-reset" title="リセット" type="button"><i class="fa-solid fa-rotate-left"></i></button>
    `;
    container.appendChild(controls);
    
    setupMermaidZoomPan(container, viewport);
}

function setupMermaidZoomPan(container, viewport) {
    const svg = viewport.querySelector('svg');
    if (!svg) return;
    
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    
    svg.style.transformOrigin = 'center center';
    svg.style.transition = 'transform 0.15s ease-out';
    svg.style.cursor = 'grab';
    
    function updateTransform(useTransition = true) {
        svg.style.transition = useTransition ? 'transform 0.15s ease-out' : 'none';
        svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
    
    // Mouse Wheel Zoom
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            scale = Math.min(scale * zoomFactor, 8);
        } else {
            scale = Math.max(scale / zoomFactor, 0.15);
        }
        updateTransform(true);
    }, { passive: false });
    
    // Mouse Drag Pan
    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.mermaid-zoom-controls')) return;
        
        isDragging = true;
        svg.style.cursor = 'grabbing';
        
        const startX = e.clientX - translateX;
        const startY = e.clientY - translateY;
        
        function onMouseMove(moveEvent) {
            if (!isDragging) return;
            translateX = moveEvent.clientX - startX;
            translateY = moveEvent.clientY - startY;
            updateTransform(false); // disable transition for smooth dragging
        }
        
        function onMouseUp() {
            isDragging = false;
            svg.style.cursor = 'grab';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault();
    });
    
    // Touch Zoom & Pan (Mobile support)
    let touchStartDist = 0;
    let touchStartScale = 1;
    let isPinching = false;
    let touchStartX = 0;
    let touchStartY = 0;
    
    viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('.mermaid-zoom-controls')) return;
        
        if (e.touches.length === 2) {
            isPinching = true;
            touchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchStartScale = scale;
        } else if (e.touches.length === 1) {
            isDragging = true;
            touchStartX = e.touches[0].clientX - translateX;
            touchStartY = e.touches[0].clientY - translateY;
        }
    });
    
    viewport.addEventListener('touchmove', (e) => {
        if (isPinching && e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            scale = Math.min(Math.max(touchStartScale * (dist / touchStartDist), 0.15), 8);
            updateTransform(false);
            e.preventDefault();
        } else if (isDragging && e.touches.length === 1) {
            translateX = e.touches[0].clientX - touchStartX;
            translateY = e.touches[0].clientY - touchStartY;
            updateTransform(false);
            e.preventDefault();
        }
    }, { passive: false });
    
    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            isPinching = false;
        }
        if (e.touches.length === 0) {
            isDragging = false;
        }
    });
    
    // Zoom control button click handlers with safety checks
    const btnIn = container.querySelector('.zoom-in');
    const btnOut = container.querySelector('.zoom-out');
    const btnReset = container.querySelector('.zoom-reset');
    
    if (btnIn) {
        btnIn.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = Math.min(scale * 1.25, 8);
            updateTransform(true);
        });
    }
    
    if (btnOut) {
        btnOut.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = Math.max(scale / 1.25, 0.15);
            updateTransform(true);
        });
    }
    
    if (btnReset) {
        btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform(true);
        });
    }
}

// --- Mermaid Render Engine ---
async function renderMermaidDiagrams() {
    const mermaidCodes = previewOutput.querySelectorAll('pre code.language-mermaid');
    
    for (let i = 0; i < mermaidCodes.length; i++) {
        const codeElement = mermaidCodes[i];
        const preElement = codeElement.parentElement;
        const rawCode = codeElement.textContent.trim();
        
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        container.setAttribute('data-mermaid-code', rawCode);
        container.setAttribute('contenteditable', 'false');
        
        const renderId = `mermaid-render-${Date.now()}-${i}`;
        
        try {
            const { svg } = await mermaid.render(renderId, rawCode);
            applyZoomPanToMermaid(container, svg);
        } catch (err) {
            console.error("Mermaid Render Error:", err);
            
            const errorElement = document.createElement('div');
            errorElement.className = 'mermaid-error';
            errorElement.textContent = `Mermaid 構文エラー:\n${err.message || err}`;
            container.appendChild(errorElement);
            
            initMermaid();
        }
        
        if (preElement.parentNode) {
            preElement.replaceWith(container);
        }
    }
    
    // Setup hover edit buttons for WYSIWYG visual mode
    if (currentMode === 'visual') {
        setupEditableBlocks();
    }
}

// --- WYSIWYG Editable Block Wrapper Generator ---
function setupEditableBlocks() {
    // 1. Wrap Mermaid Diagrams
    const mermaidContainers = previewOutput.querySelectorAll('.mermaid-container');
    mermaidContainers.forEach((container) => {
        if (container.parentElement.classList.contains('editable-block-wrapper')) return;
        
        container.setAttribute('contenteditable', 'false');
        
        const wrapper = document.createElement('div');
        wrapper.className = 'editable-block-wrapper';
        wrapper.setAttribute('contenteditable', 'false');
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);
        
        const overlay = document.createElement('div');
        overlay.className = 'block-edit-overlay';
        overlay.setAttribute('contenteditable', 'false');
        overlay.innerHTML = `<button class="btn-edit-block" contenteditable="false"><i class="fa-solid fa-pen"></i> Mermaid編集</button>`;
        wrapper.appendChild(overlay);
        
        overlay.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(container, 'mermaid');
        });
    });
    
    // 2. Wrap Standard Code Blocks (pre tags)
    const preTags = previewOutput.querySelectorAll('pre');
    preTags.forEach((pre) => {
        // Skip if this pre is actually a mermaid block that will be rendered later asynchronously
        const codeEl = pre.querySelector('code');
        if (codeEl && codeEl.classList.contains('language-mermaid')) return;
        
        if (pre.closest('.mermaid-container')) return; // Skip if inside mermaid
        if (pre.parentElement.classList.contains('editable-block-wrapper')) return;
        
        pre.setAttribute('contenteditable', 'false');
        
        // Ensure data-raw-code is stored
        if (!pre.hasAttribute('data-raw-code')) {
            pre.setAttribute('data-raw-code', codeEl ? codeEl.textContent : pre.textContent);
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'editable-block-wrapper';
        wrapper.setAttribute('contenteditable', 'false');
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        
        const overlay = document.createElement('div');
        overlay.className = 'block-edit-overlay';
        overlay.setAttribute('contenteditable', 'false');
        overlay.innerHTML = `<button class="btn-edit-block" contenteditable="false"><i class="fa-solid fa-pen"></i> コード編集</button>`;
        wrapper.appendChild(overlay);
        
        overlay.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(pre, 'code');
        });
    });
}

// --- Visual to Source Synchronizer (HTML -> Markdown) ---
function syncVisualToSource() {
    if (!wasmReady) return;
    
    // Clone node to strip overlays and formatting classes before sending to parser
    const docClone = previewOutput.cloneNode(true);
    
    // Remove all edit overlays
    docClone.querySelectorAll('.block-edit-overlay').forEach(el => el.remove());
    
    // Unwrap the editable-block-wrapper divs
    docClone.querySelectorAll('.editable-block-wrapper').forEach(wrapper => {
        const child = wrapper.firstElementChild;
        if (child) {
            wrapper.parentNode.insertBefore(child, wrapper);
        }
        wrapper.remove();
    });
    
    // Restore db: ID to src and href attributes in clone before parsing to markdown
    docClone.querySelectorAll('img').forEach(img => {
        const dbId = img.getAttribute('data-db-id');
        if (dbId) {
            img.setAttribute('src', 'db:' + dbId);
        }
    });
    docClone.querySelectorAll('a').forEach(link => {
        const dbId = link.getAttribute('data-db-id');
        if (dbId) {
            link.setAttribute('href', 'db:' + dbId);
        }
    });
    
    // Remove all zero-width spaces (\u200B) globally
    const htmlContent = docClone.innerHTML.replace(/\u200B/g, '');
    
    // Call the Go WASM HTML to Markdown parser
    const markdown = window.convertHtmlToMarkdown(htmlContent);
    
    // Update the textarea value
    textarea.value = markdown;
    
    // Save to local storage and update stats
    localStorage.setItem('wasmdedit_markdown', markdown);
    updateMetadata();
}

// --- Mode Switcher Logic ---
function toggleMode(mode) {
    if (mode === currentMode) return;
    
    const btnSource = document.getElementById('btn-mode-source');
    const btnVisual = document.getElementById('btn-mode-visual');
    
    if (mode === 'visual') {
        // Sync source to visual first
        renderMarkdown();
        
        // Toggle view containers
        workspaceLayout.className = 'workspace-panels view-preview';
        previewOutput.setAttribute('contenteditable', 'true');
        
        // Hide scroll sync button
        document.getElementById('btn-sync-scroll-toggle').style.display = 'none';
        
        // Active states
        btnSource.classList.remove('active');
        btnVisual.classList.add('active');
        currentMode = 'visual';
        
        // Set up the code/mermaid edit wraps
        setupEditableBlocks();
        
        // Focus on preview
        previewOutput.focus();
    } else {
        // Sync visual to source
        syncVisualToSource();
        
        // Restore layout
        workspaceLayout.className = 'workspace-panels';
        previewOutput.setAttribute('contenteditable', 'false');
        
        // Show scroll sync button
        document.getElementById('btn-sync-scroll-toggle').style.display = 'flex';
        
        // Active states
        btnSource.classList.add('active');
        btnVisual.classList.remove('active');
        currentMode = 'source';
        
        // Re-highlight the markdown text code block rendering
        renderMarkdown();
        
        // Focus on textarea
        textarea.focus();
    }
    
    localStorage.setItem('wasmdedit_mode', currentMode);
}

// --- Modal Dialog for Code Blocks Editing ---
function openEditModal(element, type) {
    activeEditingElement = element;
    activeEditingType = type;
    
    let code = "";
    if (type === 'mermaid') {
        modalTitle.innerHTML = '<i class="fa-solid fa-diagram-project"></i> Mermaid ダイアグラム編集';
        code = element.getAttribute('data-mermaid-code') || "";
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-code"></i> コードブロック編集';
        code = element.getAttribute('data-raw-code') || element.textContent || "";
    }
    
    modalTextarea.value = code;
    
    editorModal.classList.add('active');
    modalTextarea.focus();
}

function closeEditModal() {
    editorModal.classList.remove('active');
    activeEditingElement = null;
    activeEditingType = null;
}

async function saveEditModal() {
    if (!activeEditingElement) return;
    
    const editedCode = modalTextarea.value;
    
    if (activeEditingType === 'mermaid') {
        // Update raw code attribute
        activeEditingElement.setAttribute('data-mermaid-code', editedCode);
        
        // Re-render the diagram
        const renderId = `mermaid-render-${Date.now()}`;
        activeEditingElement.innerHTML = `<div class="mermaid-loading"><i class="fa-solid fa-spinner fa-spin"></i> レンダリング中...</div>`;
        
        try {
            const { svg } = await mermaid.render(renderId, editedCode);
            applyZoomPanToMermaid(activeEditingElement, svg);
        } catch (err) {
            console.error(err);
            activeEditingElement.innerHTML = `<div class="mermaid-error">Mermaid 構文エラー:\n${err.message || err}</div>`;
            initMermaid();
        }
    } else {
        // Standard code block
        activeEditingElement.setAttribute('data-raw-code', editedCode);
        
        // Get lang
        const codeNode = activeEditingElement.querySelector('code');
        const langClass = codeNode ? codeNode.className : 'language-text';
        
        activeEditingElement.innerHTML = `<code class="${langClass}"></code>`;
        const newCodeNode = activeEditingElement.querySelector('code');
        newCodeNode.textContent = editedCode;
        
        // Reapply syntax highlighting
        Prism.highlightElement(newCodeNode);
    }
    
    // Sync WYSIWYG back to Markdown source
    syncVisualToSource();
    closeEditModal();
}

// --- Selection Manipulators in WYSIWYG ---
function insertNodeAtSelection(node) {
    const selection = window.getSelection();
    if (selection.getRangeAt && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        
        // Move selection cursor after the node
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function insertMermaidVisualTemplate(templateText) {
    const rawCode = templateText.replace(/```mermaid\n|```/g, '').trim();
    
    const container = document.createElement('div');
    container.className = 'mermaid-container';
    container.setAttribute('data-mermaid-code', rawCode);
    container.setAttribute('contenteditable', 'false');
    container.innerHTML = `<div class="mermaid-loading"><i class="fa-solid fa-spinner fa-spin"></i> レンダリング中...</div>`;
    
    insertNodeAtSelection(container);
    
    // Wrap it
    const wrapper = document.createElement('div');
    wrapper.className = 'editable-block-wrapper';
    wrapper.setAttribute('contenteditable', 'false');
    container.parentNode.insertBefore(wrapper, container);
    wrapper.appendChild(container);
    
    const overlay = document.createElement('div');
    overlay.className = 'block-edit-overlay';
    overlay.setAttribute('contenteditable', 'false');
    overlay.innerHTML = `<button class="btn-edit-block" contenteditable="false"><i class="fa-solid fa-pen"></i> Mermaid編集</button>`;
    wrapper.appendChild(overlay);
    
    overlay.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(container, 'mermaid');
    });
    
    // Render Async
    const renderId = `mermaid-render-${Date.now()}`;
    mermaid.render(renderId, rawCode).then(({ svg }) => {
        applyZoomPanToMermaid(container, svg);
        syncVisualToSource();
    }).catch(err => {
        console.error(err);
        container.innerHTML = `<div class="mermaid-error">Mermaid 構文エラー:\n${err.message || err}</div>`;
        initMermaid();
        syncVisualToSource();
    });
}

// --- Debounce Helper ---
function debounceRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (currentMode === 'source') {
            renderMarkdown();
            updateMetadata();
        } else {
            syncVisualToSource();
        }
    }, 300);
}

// --- Stats & Line Counters ---
function updateMetadata() {
    const text = textarea.value;
    const lines = text.split('\n').length;
    linesCounter.textContent = `行数: ${lines}`;
    const chars = text.replace(/\n/g, '').length;
    wordsCounter.textContent = `文字数: ${chars}`;
}

// --- Formatting Core Operations ---
function formatText(command, value = null) {
    if (currentMode === 'source') {
        let tokenBefore = '';
        let tokenAfter = '';
        
        switch (command) {
            case 'bold':
                tokenBefore = '**'; tokenAfter = '**'; break;
            case 'italic':
                tokenBefore = '*'; tokenAfter = '*'; break;
            case 'strikeThrough':
                tokenBefore = '~~'; tokenAfter = '~~'; break;
            case 'h1':
                tokenBefore = '\n# '; break;
            case 'h2':
                tokenBefore = '\n## '; break;
            case 'h3':
                tokenBefore = '\n### '; break;
            case 'ul':
                tokenBefore = '\n- '; break;
            case 'ol':
                tokenBefore = '\n1. '; break;
            case 'table':
                tokenBefore = '\n\n| ヘッダー1 | ヘッダー2 |\n| --- | --- |\n| セル1 | セル2 |\n\n'; break;
        }
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);
        
        const replacement = tokenBefore + selectedText + tokenAfter;
        textarea.value = text.substring(0, start) + replacement + text.substring(end);
        
        textarea.focus();
        textarea.selectionStart = start + tokenBefore.length;
        textarea.selectionEnd = start + tokenBefore.length + selectedText.length;
        
        debounceRender();
    } else {
        switch (command) {
            case 'bold':
                document.execCommand('bold'); break;
            case 'italic':
                document.execCommand('italic'); break;
            case 'strikeThrough':
                document.execCommand('strikeThrough'); break;
            case 'h1':
                document.execCommand('formatBlock', false, '<h1>'); break;
            case 'h2':
                document.execCommand('formatBlock', false, '<h2>'); break;
            case 'h3':
                document.execCommand('formatBlock', false, '<h3>'); break;
            case 'ul':
                document.execCommand('insertUnorderedList'); break;
            case 'ol':
                document.execCommand('insertOrderedList'); break;
            case 'table':
                const table = document.createElement('table');
                table.innerHTML = `
                    <thead>
                        <tr><th>ヘッダー1</th><th>ヘッダー2</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>セル1</td><td>セル2</td></tr>
                    </tbody>
                `;
                insertNodeAtSelection(table);
                break;
        }
        syncVisualToSource();
    }
}

// --- Visual Mode Auto-Formatting Helpers ---
function getParentBlock(node) {
    let curr = node;
    while (curr && curr !== previewOutput) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
            const tag = curr.tagName.toLowerCase();
            if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tag)) {
                return curr;
            }
        }
        curr = curr.parentNode;
    }
    return null;
}

// Convert current block to heading tag
function formatBlock(block, newTag, prefix) {
    let contentText = block.textContent;
    if (contentText.startsWith(prefix)) {
        contentText = contentText.substring(prefix.length);
    }
    
    const newBlock = document.createElement(newTag);
    newBlock.textContent = contentText || '\u200B';
    
    block.parentNode.replaceChild(newBlock, block);
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(newBlock);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    syncVisualToSource();
}

// Convert current block to bullet or ordered list
function formatBlockList(block, listTag, prefix) {
    let contentText = block.textContent;
    if (contentText.startsWith(prefix)) {
        contentText = contentText.substring(prefix.length);
    }
    
    const list = document.createElement(listTag);
    const li = document.createElement('li');
    li.textContent = contentText || '\u200B';
    list.appendChild(li);
    
    block.parentNode.replaceChild(list, block);
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    syncVisualToSource();
}

function checkInlineFormatting(textNode) {
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const text = textNode.nodeValue;
    
    const boldRegex = /(?<!\*)\*\*([^*]+?)\*\*(?!\*)/;
    const strikeRegex = /(?<!~)~~([^~]+?)~~(?!~)/;
    const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/;
    
    let match = text.match(boldRegex);
    let tag = 'strong';
    
    if (!match) {
        match = text.match(strikeRegex);
        tag = 'del';
    }
    if (!match) {
        match = text.match(italicRegex);
        tag = 'em';
    }
    
    if (match) {
        const fullMatch = match[0];
        const content = match[1];
        const index = match.index;
        
        const parent = textNode.parentNode;
        const beforeText = text.substring(0, index);
        let afterText = text.substring(index + fullMatch.length);
        
        // Prevent sticky formatting: if the text after the inline element is empty,
        // insert a zero-width space (\u200B) to ensure the caret can "escape" the inline style.
        let usesZeroWidthSpace = false;
        if (afterText === "") {
            afterText = "\u200B";
            usesZeroWidthSpace = true;
        }
        
        const beforeNode = document.createTextNode(beforeText);
        const formattedNode = document.createElement(tag);
        formattedNode.textContent = content;
        const afterNode = document.createTextNode(afterText);
        
        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(formattedNode, textNode);
        parent.insertBefore(afterNode, textNode);
        textNode.remove();
        
        const selection = window.getSelection();
        const range = document.createRange();
        // Position caret after the zero-width space to write outside the style node
        range.setStart(afterNode, usesZeroWidthSpace ? 1 : 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        syncVisualToSource();
        checkInlineFormatting(afterNode);
    }
}

function handleVisualModeInput(e) {
    if (currentMode !== 'visual') return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    const block = getParentBlock(node);
    if (block) {
        const text = block.textContent;
        const tag = block.tagName.toLowerCase();
        
        if (tag === 'p' || tag === 'div' || tag === 'span' || tag.startsWith('h')) {
            if (text.startsWith('# ')) {
                formatBlock(block, 'h1', '# ');
                return;
            } else if (text.startsWith('## ')) {
                formatBlock(block, 'h2', '## ');
                return;
            } else if (text.startsWith('### ')) {
                formatBlock(block, 'h3', '### ');
                return;
            } else if (text.startsWith('- ') || text.startsWith('* ')) {
                const prefix = text.startsWith('- ') ? '- ' : '* ';
                formatBlockList(block, 'ul', prefix);
                return;
            } else if (text.startsWith('1. ')) {
                formatBlockList(block, 'ol', '1. ');
                return;
            }
        }
    }
    
    // Check inline formatting (bold, strikethrough, italic)
    checkInlineFormatting(node);
}

// --- Visual Table Column / Row Editors ---
function handleTableFocus() {
    if (currentMode !== 'visual') {
        document.getElementById('table-tools').style.display = 'none';
        activeTableCell = null;
        return;
    }
    
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        document.getElementById('table-tools').style.display = 'none';
        activeTableCell = null;
        return;
    }
    
    let curr = selection.getRangeAt(0).startContainer;
    let cell = null;
    
    while (curr && curr !== previewOutput) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
            const tag = curr.tagName.toLowerCase();
            if (tag === 'td' || tag === 'th') {
                cell = curr;
                break;
            }
        }
        curr = curr.parentNode;
    }
    
    const tableTools = document.getElementById('table-tools');
    if (cell) {
        activeTableCell = cell;
        tableTools.style.display = 'flex';
    } else {
        activeTableCell = null;
        tableTools.style.display = 'none';
    }
}

// Add row below currently focused cell
function tableAddRow() {
    if (!activeTableCell) return;
    const tr = activeTableCell.closest('tr');
    const table = activeTableCell.closest('table');
    if (!tr || !table) return;
    
    const cellCount = tr.cells.length;
    const newTr = document.createElement('tr');
    
    // Cells added to new rows are ALWAYS <td> data cells
    for (let i = 0; i < cellCount; i++) {
        const newCell = document.createElement('td');
        newCell.innerHTML = 'セル';
        newTr.appendChild(newCell);
    }
    
    const parentTag = tr.parentNode.tagName.toLowerCase();
    if (parentTag === 'thead') {
        // If focused in the header row, insert new row into tbody (as the first row)
        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }
        tbody.insertBefore(newTr, tbody.firstChild);
    } else {
        // Normal insert below the current row
        tr.parentNode.insertBefore(newTr, tr.nextSibling);
    }
    
    syncVisualToSource();
}

// Add column to the right of currently focused cell
function tableAddColumn() {
    if (!activeTableCell) return;
    const tr = activeTableCell.closest('tr');
    const table = activeTableCell.closest('table');
    if (!tr || !table) return;
    
    const colIndex = activeTableCell.cellIndex;
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cellTag = row.parentNode.tagName.toLowerCase() === 'thead' ? 'th' : 'td';
        const newCell = document.createElement(cellTag);
        newCell.innerHTML = 'セル';
        
        if (colIndex < row.cells.length) {
            row.insertBefore(newCell, row.cells[colIndex].nextSibling);
        } else {
            row.appendChild(newCell);
        }
    });
    
    syncVisualToSource();
}

// Delete currently focused row
function tableDeleteRow() {
    if (!activeTableCell) return;
    const tr = activeTableCell.closest('tr');
    const table = activeTableCell.closest('table');
    if (!tr || !table) return;
    
    tr.remove();
    
    document.getElementById('table-tools').style.display = 'none';
    activeTableCell = null;
    
    if (!table.querySelector('tr')) {
        table.remove();
    }
    
    syncVisualToSource();
}

// Delete currently focused column
function tableDeleteColumn() {
    if (!activeTableCell) return;
    const table = activeTableCell.closest('table');
    if (!table) return;
    
    const colIndex = activeTableCell.cellIndex;
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (colIndex < row.cells.length) {
            row.deleteCell(colIndex);
        }
    });
    
    document.getElementById('table-tools').style.display = 'none';
    activeTableCell = null;
    
    const firstRow = table.querySelector('tr');
    if (!firstRow || firstRow.cells.length === 0) {
        table.remove();
    }
    
    syncVisualToSource();
}

// --- Sync Scrolling System ---
function setupSyncScroll() {
    textarea.addEventListener('scroll', () => {
        if (currentMode === 'visual' || !syncScrollEnabled || isScrollingPreview) return;
        isScrollingEditor = true;
        const scrollPct = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
        previewContainer.scrollTop = scrollPct * (previewContainer.scrollHeight - previewContainer.clientHeight);
        setTimeout(() => { isScrollingEditor = false; }, 50);
    });

    previewContainer.addEventListener('scroll', () => {
        if (currentMode === 'visual' || !syncScrollEnabled || isScrollingEditor) return;
        isScrollingPreview = true;
        const scrollPct = previewContainer.scrollTop / (previewContainer.scrollHeight - previewContainer.clientHeight);
        textarea.scrollTop = scrollPct * (textarea.scrollHeight - textarea.clientHeight);
        setTimeout(() => { isScrollingPreview = false; }, 50);
    });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Mode Switch events
    document.getElementById('btn-mode-source').addEventListener('click', () => { toggleMode('source'); handleTableFocus(); });
    document.getElementById('btn-mode-visual').addEventListener('click', () => { toggleMode('visual'); handleTableFocus(); });
    
    // Formatting buttons event listeners
    document.getElementById('btn-fmt-bold').addEventListener('click', () => formatText('bold'));
    document.getElementById('btn-fmt-italic').addEventListener('click', () => formatText('italic'));
    document.getElementById('btn-fmt-strike').addEventListener('click', () => formatText('strikeThrough'));
    document.getElementById('btn-fmt-h1').addEventListener('click', () => formatText('h1'));
    document.getElementById('btn-fmt-h2').addEventListener('click', () => formatText('h2'));
    document.getElementById('btn-fmt-h3').addEventListener('click', () => formatText('h3'));
    document.getElementById('btn-fmt-ul').addEventListener('click', () => formatText('ul'));
    document.getElementById('btn-fmt-ol').addEventListener('click', () => formatText('ol'));
    document.getElementById('btn-fmt-table').addEventListener('click', () => formatText('table'));
    
    // Table Tools buttons event listeners
    document.getElementById('btn-table-add-row').addEventListener('click', tableAddRow);
    document.getElementById('btn-table-add-col').addEventListener('click', tableAddColumn);
    document.getElementById('btn-table-del-row').addEventListener('click', tableDeleteRow);
    document.getElementById('btn-table-del-col').addEventListener('click', tableDeleteColumn);
    
    // Edit Modal events
    document.getElementById('btn-close-modal').addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeEditModal);
    document.getElementById('btn-save-modal').addEventListener('click', saveEditModal);
    
    // Listen for WYSIWYG changes
    previewOutput.addEventListener('input', (e) => {
        if (currentMode === 'visual') {
            handleVisualModeInput(e);
            debounceRender();
        }
    });
    
    // Track table cell focus in visual mode
    previewOutput.addEventListener('click', handleTableFocus);
    previewOutput.addEventListener('keyup', handleTableFocus);
    
    // Textarea input
    textarea.addEventListener('input', debounceRender);
    
    // Sync scroll
    setupSyncScroll();
    
    // Toolbar buttons
    document.getElementById('btn-new').addEventListener('click', fileNew);
    document.getElementById('btn-open').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', fileOpen);
    document.getElementById('btn-save').addEventListener('click', fileSave);
    document.getElementById('btn-export-html').addEventListener('click', exportToHTML);
    document.getElementById('btn-export-pdf').addEventListener('click', () => window.print());
    
    // Theme Toggle
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    
    // Sidebar Toggle
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        btnToggleSidebar.classList.toggle('active');
    });
    
    // Clear Text
    document.getElementById('btn-clear-text').addEventListener('click', () => {
        if (confirm("テキストをすべてクリアしますか？")) {
            textarea.value = '';
            previewOutput.innerHTML = '';
            textarea.focus();
            debounceRender();
        }
    });

    // Sync scroll button
    const btnSyncScroll = document.getElementById('btn-sync-scroll-toggle');
    btnSyncScroll.addEventListener('click', () => {
        syncScrollEnabled = !syncScrollEnabled;
        btnSyncScroll.classList.toggle('active');
    });
    
    // Layout views
    const btnViewEditor = document.getElementById('btn-view-editor');
    const btnViewSplit = document.getElementById('btn-view-split');
    const btnViewPreview = document.getElementById('btn-view-preview');
    
    btnViewEditor.addEventListener('click', () => {
        if (currentMode === 'visual') return; // Split controls disabled in visual
        setViewLayout('view-editor');
        setActiveViewButton(btnViewEditor);
    });
    
    btnViewSplit.addEventListener('click', () => {
        if (currentMode === 'visual') return;
        setViewLayout('view-split');
        setActiveViewButton(btnViewSplit);
    });
    
    btnViewPreview.addEventListener('click', () => {
        if (currentMode === 'visual') return;
        setViewLayout('view-preview');
        setActiveViewButton(btnViewPreview);
    });
    
    // Templates insertion
    document.querySelectorAll('.tpl-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const templateKey = button.getAttribute('data-template');
            const templateText = templates[templateKey];
            if (!templateText) return;
            
            if (currentMode === 'source') {
                insertTextAtCursor(templateText);
            } else {
                insertMermaidVisualTemplate(templateText);
            }
        });
    });
    
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // Ctrl+Alt+S / Ctrl+Alt+V for mode switching
        if (e.ctrlKey && e.altKey && e.key === 's') {
            e.preventDefault();
            toggleMode('source');
        }
        if (e.ctrlKey && e.altKey && e.key === 'v') {
            e.preventDefault();
            toggleMode('visual');
        }
        // Formatting shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            formatText('bold');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            formatText('italic');
        }
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
        insertTextAtCursor('    '); 
    }
    
    if (e.key === 'Enter') {
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPosition);
        const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
        const lastLine = textBeforeCursor.substring(lastLineStart);
        
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
        localSyncActiveFile = null; // Reset local sync active file
        updateFilenameDisplay();
        refreshLocalFilesList(); // Clear active file highlights
        
        if (currentMode === 'visual') {
            renderMarkdown();
        } else {
            renderMarkdown();
        }
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
        
        if (currentMode === 'visual') {
            renderMarkdown();
        } else {
            renderMarkdown();
        }
        debounceRender();
        
        e.target.value = '';
    };
    reader.readAsText(file);
}

async function fileSave() {
    if (currentMode === 'visual') {
        syncVisualToSource();
    }
    
    if (localSyncEnabled && localSyncActiveFile) {
        const success = await saveToLocalFile(localSyncActiveFile, textarea.value);
        if (success) {
            lastSavedContent = textarea.value;
            showStatusNotification(`ローカルファイル "${localSyncActiveFile}" に保存しました`);
            return;
        }
    }
    
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
    
    const prismThemeLink = document.getElementById('prism-theme');
    if (newTheme === 'dark') {
        prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
    } else {
        prismThemeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
    }
    
    initMermaid();
    
    if (wasmReady) {
        if (currentMode === 'visual') {
            syncVisualToSource();
            renderMarkdown();
        } else {
            renderMarkdown();
        }
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
    if (currentMode === 'visual') {
        syncVisualToSource();
    }
    
    // Re-render standard HTML to ensure clean DOM, and wait for Mermaid rendering to finish
    await renderMarkdown();
    
    // Clone previewOutput to resolve IndexedDB files to Base64 for export
    const exportClone = previewOutput.cloneNode(true);
    
    // Remove all edit overlays and zoom controls
    exportClone.querySelectorAll('.block-edit-overlay, .mermaid-zoom-controls').forEach(el => el.remove());
    
    // Unwrap the editable-block-wrapper divs
    exportClone.querySelectorAll('.editable-block-wrapper').forEach(wrapper => {
        const child = wrapper.firstElementChild;
        if (child) {
            wrapper.parentNode.insertBefore(child, wrapper);
        }
        wrapper.remove();
    });

    // Unwrap the mermaid-viewport divs to restore standard SVG position
    exportClone.querySelectorAll('.mermaid-viewport').forEach(viewport => {
        const child = viewport.firstElementChild;
        if (child) {
            viewport.parentNode.insertBefore(child, viewport);
        }
        viewport.remove();
    });
    
    const images = exportClone.querySelectorAll('img');
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const dbId = img.getAttribute('data-db-id');
        if (dbId) {
            try {
                const record = await getFileFromDB(dbId);
                if (record && record.blob) {
                    const base64 = await readBlobAsDataURL(record.blob);
                    img.src = base64;
                }
            } catch (err) {
                console.error("Failed to convert image to Base64 for export", err);
            }
        }
    }
    
    const links = exportClone.querySelectorAll('a');
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const dbId = link.getAttribute('data-db-id');
        if (dbId) {
            try {
                const record = await getFileFromDB(dbId);
                if (record && record.blob) {
                    const base64 = await readBlobAsDataURL(record.blob);
                    link.href = base64;
                }
            } catch (err) {
                console.error("Failed to convert link file to Base64 for export", err);
            }
        }
    }
    
    // Strip zero-width space (\u200B) from exported HTML
    const parsedHtml = exportClone.innerHTML.replace(/\u200B/g, '');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const activeTheme = isDark ? 'dark' : 'light';
    const prismThemeUrl = isDark 
        ? "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";

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

    const blob = new Blob([htmlDocString], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = currentFilename.replace('.md', '.html');
    link.click();
    URL.revokeObjectURL(link.href);
    
    // Restore visual blocks wrapper if in visual mode
    if (currentMode === 'visual') {
        setupEditableBlocks();
    }
}

// --- Drag and Drop File Handlers ---
let isInternalDragging = false;

// IndexedDB Constants
const DB_NAME = 'WasmDEditDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';
let dbInstance = null;

// Object URL cache to reuse urls and prevent leaks
const objectURLCache = new Map();

function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        request.onerror = (e) => {
            console.error("IndexedDB open failed", e);
            reject(e.target.error);
        };
    });
}

function saveFileToDB(id, name, type, blob) {
    return initDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const record = { id, name, type, blob };
            const request = store.put(record);
            request.onsuccess = () => resolve(id);
            request.onerror = (e) => reject(e.target.error);
        });
    });
}

function getFileFromDB(id) {
    return initDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    });
}

function resolveLocalDBFiles(container) {
    // 1. Resolve Images
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('db:')) {
            const id = src.substring(3);
            img.setAttribute('data-db-id', id);
            img.style.opacity = '0.5'; // Dim while loading
            
            // Check cache
            if (objectURLCache.has(id)) {
                img.src = objectURLCache.get(id);
                img.style.opacity = '1';
            } else {
                getFileFromDB(id).then(record => {
                    if (record && record.blob) {
                        const objectURL = URL.createObjectURL(record.blob);
                        objectURLCache.set(id, objectURL);
                        img.src = objectURL;
                        img.style.opacity = '1';
                    } else {
                        console.error("Image record not found in IndexedDB:", id);
                        img.style.opacity = '1';
                    }
                }).catch(err => {
                    console.error("Failed to load image from IndexedDB", err);
                    img.style.opacity = '1';
                });
            }
        }
    });

    // 2. Resolve Links
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('db:')) {
            const id = href.substring(3);
            link.setAttribute('data-db-id', id);
            
            if (objectURLCache.has(id)) {
                link.href = objectURLCache.get(id);
            } else {
                getFileFromDB(id).then(record => {
                    if (record && record.blob) {
                        const objectURL = URL.createObjectURL(record.blob);
                        objectURLCache.set(id, objectURL);
                        link.href = objectURL;
                    }
                }).catch(err => {
                    console.error("Failed to load file from IndexedDB", err);
                });
            }
        }
    });
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone-overlay');
    let dragCounter = 0;
    
    window.addEventListener('dragstart', (e) => {
        isInternalDragging = true;
    });
    
    window.addEventListener('dragend', (e) => {
        isInternalDragging = false;
    });
    
    window.addEventListener('dragenter', (e) => {
        if (isInternalDragging) return;
        
        // Only trigger overlay and prevent default if dragging actual files
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dragCounter++;
            dropZone.classList.add('active');
        }
    });
    
    window.addEventListener('dragover', (e) => {
        if (isInternalDragging) return;
        
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
        }
    });
    
    window.addEventListener('dragleave', (e) => {
        if (isInternalDragging) return;
        
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                dropZone.classList.remove('active');
            }
        }
    });
    
    window.addEventListener('drop', (e) => {
        if (isInternalDragging) return;
        
        if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dragCounter = 0;
            dropZone.classList.remove('active');
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                // Synchronously capture the drop coordinates/position
                const dropPosition = getDropPosition(e);
                handleDroppedFiles(e.dataTransfer.files, dropPosition);
            }
        }
    });
}

function getDropPosition(e) {
    if (currentMode === 'source') {
        if (e.target === textarea) {
            return {
                mode: 'source',
                offset: textarea.selectionStart
            };
        } else {
            return {
                mode: 'source',
                offset: textarea.selectionStart
            };
        }
    } else {
        // Visual mode: contenteditable caret position from coordinates
        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (position) {
                range = document.createRange();
                range.setStart(position.offsetNode, position.offset);
                range.setEnd(position.offsetNode, position.offset);
            }
        } else if (e.rangeParent) {
            range = document.createRange();
            range.setStart(e.rangeParent, e.rangeOffset);
            range.setEnd(e.rangeParent, e.rangeOffset);
        }
        
        // Check if range is inside our editable visual output container
        if (range && previewOutput.contains(range.startContainer)) {
            return {
                mode: 'visual',
                range: range
            };
        } else {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                return {
                    mode: 'visual',
                    range: selection.getRangeAt(0).cloneRange()
                };
            }
        }
    }
    return null;
}

async function handleDroppedFiles(files, dropPosition) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isTextFile = file.type === 'text/plain' || 
                           file.name.endsWith('.md') || 
                           file.name.endsWith('.markdown') || 
                           file.name.endsWith('.txt');
        
        if (isTextFile) {
            // Text files are read and inserted directly into the cursor position
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                insertTextAtPosition(text, dropPosition);
            };
            reader.readAsText(file);
        } else {
            // Image or other binary files: store in browser's local cache (IndexedDB)
            try {
                const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                const filename = file.name || 'file.bin';
                const isImage = file.type.startsWith('image/');
                
                await saveFileToDB(fileId, filename, file.type, file);
                
                // Create session-scoped temporary Object URL
                const objectURL = URL.createObjectURL(file);
                objectURLCache.set(fileId, objectURL);
                
                insertFileLinkAtPosition(fileId, objectURL, filename, isImage, dropPosition);
            } catch (err) {
                console.error("IndexedDB store failed, falling back to Base64 data URL for images", err);
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target.result;
                        const filename = file.name || 'image.png';
                        insertImageAtPosition(base64Data, filename, dropPosition);
                    };
                    reader.readAsDataURL(file);
                } else {
                    alert("ローカルキャッシュへの保存に失敗しました: " + err.message);
                }
            }
        }
    }
}

function insertTextAtPosition(text, dropPosition) {
    if (dropPosition && dropPosition.mode === 'source') {
        const startPos = dropPosition.offset;
        const originalText = textarea.value;
        textarea.value = originalText.substring(0, startPos) + text + originalText.substring(startPos);
        
        const newCursorPos = startPos + text.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
        debounceRender();
    } else if (dropPosition && dropPosition.mode === 'visual' && dropPosition.range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(dropPosition.range);
        
        const textNode = document.createTextNode(text);
        insertNodeAtSelection(textNode);
        syncVisualToSource();
    } else {
        // Fallback to cursor position
        if (currentMode === 'source') {
            insertTextAtCursor(text);
        } else {
            const textNode = document.createTextNode(text);
            insertNodeAtSelection(textNode);
            syncVisualToSource();
        }
    }
}

function insertFileLinkAtPosition(id, url, filename, isImage, dropPosition) {
    if (dropPosition && dropPosition.mode === 'source') {
        const markdownLink = isImage ? `![${filename}](db:${id})` : `[${filename}](db:${id})`;
        const startPos = dropPosition.offset;
        const originalText = textarea.value;
        textarea.value = originalText.substring(0, startPos) + markdownLink + originalText.substring(startPos);
        
        const newCursorPos = startPos + markdownLink.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
        debounceRender();
    } else if (dropPosition && dropPosition.mode === 'visual' && dropPosition.range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(dropPosition.range);
        
        let node;
        if (isImage) {
            node = document.createElement('img');
            node.src = url;
            node.alt = filename;
            node.setAttribute('data-db-id', id);
            node.style.maxWidth = '100%';
            node.style.height = 'auto';
            node.style.borderRadius = '8px';
            node.style.border = '1px solid var(--border-color)';
        } else {
            node = document.createElement('a');
            node.href = url;
            node.textContent = filename;
            node.setAttribute('data-db-id', id);
            node.target = '_blank';
        }
        
        insertNodeAtSelection(node);
        syncVisualToSource();
    } else {
        // Fallback
        if (currentMode === 'source') {
            const markdownLink = isImage ? `![${filename}](db:${id})` : `[${filename}](db:${id})`;
            insertTextAtCursor(markdownLink);
        } else {
            let node;
            if (isImage) {
                node = document.createElement('img');
                node.src = url;
                node.alt = filename;
                node.setAttribute('data-db-id', id);
                node.style.maxWidth = '100%';
                node.style.height = 'auto';
                node.style.borderRadius = '8px';
                node.style.border = '1px solid var(--border-color)';
            } else {
                node = document.createElement('a');
                node.href = url;
                node.textContent = filename;
                node.setAttribute('data-db-id', id);
                node.target = '_blank';
            }
            insertNodeAtSelection(node);
            syncVisualToSource();
        }
    }
}

function insertImageAtPosition(base64Data, filename, dropPosition) {
    if (dropPosition && dropPosition.mode === 'source') {
        const markdownImage = `![${filename}](${base64Data})`;
        const startPos = dropPosition.offset;
        const originalText = textarea.value;
        textarea.value = originalText.substring(0, startPos) + markdownImage + originalText.substring(startPos);
        
        const newCursorPos = startPos + markdownImage.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
        debounceRender();
    } else if (dropPosition && dropPosition.mode === 'visual' && dropPosition.range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(dropPosition.range);
        
        const img = document.createElement('img');
        img.src = base64Data;
        img.alt = filename;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid var(--border-color)';
        
        insertNodeAtSelection(img);
        syncVisualToSource();
    } else {
        // Fallback
        insertImageAtCursor(base64Data, filename);
    }
}

function insertImageAtCursor(base64Data, filename) {
    if (currentMode === 'source') {
        const markdownImage = `![${filename}](${base64Data})`;
        insertTextAtCursor(markdownImage);
    } else {
        const img = document.createElement('img');
        img.src = base64Data;
        img.alt = filename;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid var(--border-color)';
        
        insertNodeAtSelection(img);
        syncVisualToSource();
    }
}

function readBlobAsDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsDataURL(blob);
    });
}

// --- Local Sync Folder Integration ---
let localSyncEnabled = false;
let localSyncActiveFile = null;
let lastSavedContent = "";

async function initLocalSync() {
    try {
        const response = await fetch('/api/sync/config');
        if (!response.ok) return;
        const config = await response.json();
        
        if (config.enabled) {
            localSyncEnabled = true;
            document.getElementById('section-local-files').style.display = 'block';
            
            // Register button listener
            document.getElementById('btn-sync-new-file').addEventListener('click', createNewLocalFile);
            
            // Periodically autosave to active local file if open
            setInterval(autosaveToLocalFile, 2000);
            
            // Initial load of files
            refreshLocalFilesList();
        }
    } catch (err) {
        console.warn("Failed to initialize local directory sync:", err);
    }
}

async function refreshLocalFilesList() {
    if (!localSyncEnabled) return;
    try {
        const response = await fetch('/api/sync/files');
        if (!response.ok) throw new Error("Failed to load local files");
        const files = await response.json();
        const container = document.getElementById('local-files-list');
        container.innerHTML = '';
        
        if (!files || files.length === 0) {
            container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.5rem 0;">同期フォルダは空です</div>';
            return;
        }
        
        files.forEach(filename => {
            const btn = document.createElement('button');
            btn.className = 'tpl-btn';
            btn.style.width = '100%';
            btn.style.justifyContent = 'flex-start';
            btn.style.textAlign = 'left';
            btn.style.textOverflow = 'ellipsis';
            btn.style.overflow = 'hidden';
            btn.style.whiteSpace = 'nowrap';
            btn.style.padding = '0.4rem 0.5rem';
            btn.style.marginTop = '0.2rem';
            
            if (filename === localSyncActiveFile) {
                btn.classList.add('active');
                btn.style.borderLeft = '3px solid var(--color-primary)';
                btn.style.background = 'rgba(56, 189, 248, 0.08)';
            }
            
            btn.innerHTML = `<i class="fa-regular fa-file-lines" style="margin-right:0.5rem;"></i> ${filename}`;
            btn.addEventListener('click', () => loadLocalFile(filename));
            container.appendChild(btn);
        });
    } catch (err) {
        console.error("Failed to refresh local files list:", err);
    }
}

async function loadLocalFile(filename) {
    if (!localSyncEnabled) return;
    try {
        const response = await fetch(`/api/sync/file?name=${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error("Failed to read file");
        const content = await response.text();
        
        textarea.value = content;
        currentFilename = filename;
        localSyncActiveFile = filename;
        lastSavedContent = content;
        
        updateFilenameDisplay();
        updateMetadata();
        renderMarkdown();
        refreshLocalFilesList();
        
        showStatusNotification(`ローカルファイル "${filename}" を読み込みました`);
    } catch (err) {
        alert("ファイルの読み込みに失敗しました: " + err.message);
    }
}

async function saveToLocalFile(filename, content) {
    if (!localSyncEnabled || !filename) return false;
    try {
        const response = await fetch(`/api/sync/file?name=${encodeURIComponent(filename)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/markdown' },
            body: content
        });
        if (!response.ok) throw new Error("Failed to write file");
        return true;
    } catch (err) {
        console.error("Failed to save local file:", err);
        return false;
    }
}

async function createNewLocalFile() {
    if (!localSyncEnabled) return;
    const filename = prompt("新しいファイル名を入力してください（例: memo.md）:", "new_document.md");
    if (!filename) return;
    
    // Add extension if missing
    let cleanName = filename.trim();
    if (!cleanName.endsWith('.md') && !cleanName.endsWith('.markdown') && !cleanName.endsWith('.txt')) {
        cleanName += '.md';
    }
    
    const initialContent = `# ${cleanName.replace('.md', '')}\n\n新しいドキュメント`;
    const success = await saveToLocalFile(cleanName, initialContent);
    if (success) {
        localSyncActiveFile = cleanName;
        await loadLocalFile(cleanName);
    } else {
        alert("新規ファイルの作成に失敗しました。");
    }
}

async function autosaveToLocalFile() {
    if (!localSyncEnabled || !localSyncActiveFile) return;
    
    if (currentMode === 'visual') {
        syncVisualToSource();
    }
    
    const currentContent = textarea.value;
    if (currentContent !== lastSavedContent) {
        const success = await saveToLocalFile(localSyncActiveFile, currentContent);
        if (success) {
            lastSavedContent = currentContent;
            const autosaveIndicator = document.getElementById('autosave-indicator');
            if (autosaveIndicator) {
                autosaveIndicator.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ローカル同期済み';
                autosaveIndicator.style.color = '#38bdf8';
                setTimeout(() => {
                    autosaveIndicator.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 自動保存有効';
                    autosaveIndicator.style.color = '';
                }, 1000);
            }
        }
    }
}

function showStatusNotification(message) {
    const filenameDisplay = document.getElementById('filename-display');
    const originalText = filenameDisplay.innerHTML;
    filenameDisplay.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--color-primary)"></i> ${message}`;
    setTimeout(() => {
        filenameDisplay.innerHTML = originalText;
    }, 3000);
}
