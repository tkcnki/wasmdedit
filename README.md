# WasmDEdit 🚀

WasmDEdit は、Go (WebAssembly) と Mermaid.js を組み合わせた、ブラウザ上で動作する高性能な **Markdown & Mermaid エディター** です。
WYSIWYG（ビジュアル編集）モードと、マークダウンソースコードを直接編集するソースモードの双方向編集に対応しています。

## 🌟 主な特徴

- **Go WebAssembly による高速パース**:
  GitHub Flavored Markdown (GFM) に完全対応した Go の `goldmark` パーサーがブラウザ上で直接動作し、超高速に HTML レンダリングを行います。
- **双方向 WYSIWYG（ビジュアル）編集モード**:
  レンダリング画面で直接文字入力や装飾を行うと、リアルタイムでマークダウンソースへ自動変換・同期されます。
- **インタラクティブな Mermaid ダイアグラム**:
  豊富なテンプレートを標準サポートし、図表のダブルクリックによるダイレクト編集が可能です。さらに、プレビュー上でドラッグして移動、マウスホイールで拡大・縮小できるズーム・パン機能を搭載（ズーム調整コントローラー付き）。
- **直感的なテーブル罫線操作**:
  ビジュアルモードでテーブルの罫線（縦・横）にカーソルを合わせるだけで「＋」マークが表示され、直感的かつワンクリックで行や列を追加できます。
- **スラッシュコマンド（/）でのクイック入力**:
  ビジュアルモードの行頭で `/` を入力することで、書式設定（見出し、リスト、テーブル）や各種 Mermaid 図表テンプレートを素早く挿入できます。
- **高機能なハイパーリンク作成**:
  ショートカットキー (`Ctrl+K` / `Cmd+K`) またはツールバー、スラッシュメニューからURLと表示名を2ステップで同時に入力可能。ビジュアルモードでリンクをクリックした際は遷移を抑止し、URL確認・新規タブで開く・編集・リンク解除（プレーンテキスト化）を行えるツールチップを表示します。
- **シンクロスクロール機能**:
  エディターとプレビュー側のスクロールが心地よく同期します。
- **ローカル自動保存 (LocalStorage)**:
  編集中の内容はブラウザに自動的に保存され、再起動時にも保持されます。
- **多彩なエクスポート**:
  Raw Markdown (`.md`)、スタイルがインライン化された完全な HTML (`.html`)、および PDF 出力（ブラウザ印刷機能の最適化。ズームボタンやツールチップ、スラッシュメニューなどのUI要素は自動的に除外されます）に対応。

## 🛠️ 技術スタック

- **Go (WebAssembly)**
  - [goldmark](https://github.com/yuin/goldmark) (GFM Markdown Parser)
  - `syscall/js` (Go-JS ブリッジ)
  - `golang.org/x/net/html` (HTML-to-Markdown 逆変換)
- **Frontend**
  - HTML5 & Vanilla CSS (カスタムデザインシステム / ダークテーマ)
  - JavaScript (ES6+, Vanilla)
- **Libraries**
  - [Mermaid.js v10](https://mermaid.js.org/) (ダイアグラム描画)
  - [Prism.js](https://prismjs.com/) (コードハイライト)
  - [FontAwesome v6](https://fontawesome.com/) (アイコン)

## 🚀 ローカルでのビルド＆起動方法

### 1. ビルド
リポジトリのルートディレクトリにあるビルドスクリプトを実行し、`dist/` に静的フロントエンドアセットを生成し、`bin/` ディレクトリにすべてのアセットを埋め込んだ独立実行可能なサーバーバイナリ（Linux版 `bin/server` および Windows版 `bin/server.exe`）をビルドします：

```bash
./build.sh
```

### 2. ワンバイナリでの起動
ビルドして作成されたバイナリを直接起動します：

```bash
# Linux
./bin/wasmdedit

# Windows (コマンドプロンプト / PowerShell)
.\bin\wasmdedit.exe
```
起動後、ブラウザで `http://localhost:8080` にアクセスしてエディターを起動できます。このバイナリは単独で実行可能なため、`bin/wasmdedit`（または `bin/wasmdedit.exe`）を他のディレクトリやマシンにコピーするだけでそのまま動作します。

## 🌐 GitHub Pages へのデプロイ

本プロジェクトは GitHub Actions を用いた GitHub Pages デプロイに対応しています。
安全性の観点から、サーバーバイナリやGoソースコードは除外され、動作に必要な静的フロントエンドファイル（`index.html`, `styles.css`, `app.js`, `wasm_exec.js`, `main.wasm`）のみが `dist/` ディレクトリに抽出されて配信されます。

### 設定手順
1. GitHub リポジトリの **[Settings] -> [Pages]** を開きます。
2. **Build and deployment** -> **Source** で **`GitHub Actions`** を選択します。
3. `main` ブランチへのプッシュ時にデプロイワークフローがトリガーされ、自動でデプロイが完了します。