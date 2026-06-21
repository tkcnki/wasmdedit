# WasmDEdit 🚀

WasmDEdit は、Go (WebAssembly) と Mermaid.js を組み合わせた、ブラウザ上で動作する高性能な **Markdown & Mermaid エディター** です。
WYSIWYG（ビジュアル編集）モードと、マークダウンソースコードを直接編集するソースモードの双方向編集に対応しています。

## 🌟 主な特徴

- **Go WebAssembly による高速パース**:
  GitHub Flavored Markdown (GFM) に完全対応した Go の `goldmark` パーサーがブラウザ上で直接動作し、超高速に HTML レンダリングを行います。
- **双方向 WYSIWYG（ビジュアル）編集モード**:
  レンダリング画面で直接文字入力や装飾を行うと、リアルタイムでマークダウンソースへ自動変換・同期されます。
- **Mermaid ダイアグラムのリアルタイム描画 & 編集**:
  シーケンス図、フローチャート、ガントチャートなどの豊富なテンプレートをサポート。ビジュアルモードから図をホバーしてポップアップからダイレクトに編集できます。
- **シンクロスクロール機能**:
  エディターとプレビュー側のスクロールが心地よく同期します。
- **ローカル自動保存 (LocalStorage)**:
  編集中の内容はブラウザに自動的に保存され、再起動時にも保持されます。
- **多彩なエクスポート**:
  Raw Markdown (`.md`)、スタイルがインライン化された完全な HTML (`.html`)、および PDF 出力（ブラウザ印刷機能の最適化）に対応。

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
リポジトリのルートディレクトリにあるビルドスクリプトを実行し、`dist/` ディレクトリに必要なフロントアセット、WebAssembly、および静的ファイルをすべて埋め込んだ独立実行可能なサーバーバイナリ `dist/server` をビルドします：

```bash
./build.sh
```

### 2. ワンバイナリでの起動
ビルドして作成されたバイナリを直接起動します：

```bash
./dist/server
```
起動後、ブラウザで `http://localhost:8080` にアクセスしてエディターを起動できます。このバイナリは単独で実行可能なため、`dist/server` を他のディレクトリやマシンにコピーするだけでそのまま動作します。

## 🌐 GitHub Pages へのデプロイ

本プロジェクトは GitHub Actions を用いた GitHub Pages デプロイに対応しています。
安全性の観点から、サーバーバイナリやGoソースコードは除外され、動作に必要な静的フロントエンドファイル（`index.html`, `styles.css`, `app.js`, `wasm_exec.js`, `main.wasm`）のみが `dist/` ディレクトリに抽出されて配信されます。

### 設定手順
1. GitHub リポジトリの **[Settings] -> [Pages]** を開きます。
2. **Build and deployment** -> **Source** で **`GitHub Actions`** を選択します。
3. `main` ブランチへのプッシュ時にデプロイワークフローがトリガーされ、自動でデプロイが完了します。