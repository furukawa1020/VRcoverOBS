/**
 * MarkdownLoader.ts
 * READMEとは別のMDファイルを読み込み・レンダリングするユーティリティ
 */

export class MarkdownLoader {
  /**
   * 指定パスのMarkdownファイルをフェッチして文字列として返す
   * @param path - Markdownファイルのパス（例: '/docs/OBS_SETUP_GUIDE.md'）
   * @returns Markdownテキスト
   */
  async load(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Markdownファイルの読み込みに失敗しました: ${path} (${response.status})`);
    }
    return response.text();
  }

  /**
   * 文字列中のHTML特殊文字をエスケープする
   * @param text - エスケープする文字列
   * @returns エスケープ済み文字列
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * URLが安全なプロトコル（http/https）であるか検証する
   * @param url - 検証するURL
   * @returns 安全なURLかどうか
   */
  private isSafeUrl(url: string): boolean {
    return /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#');
  }

  /**
   * MarkdownテキストをHTMLに変換する
   * @param markdown - Markdownテキスト
   * @returns HTML文字列
   */
  render(markdown: string): string {
    const lines = markdown.split('\n');
    const outputParts: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeLines: string[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0) {
        const tag = listType === 'ol' ? 'ol' : 'ul';
        outputParts.push(`<${tag}>${listItems.join('')}</${tag}>`);
        listItems = [];
        listType = null;
      }
    };

    for (const line of lines) {
      // コードブロック開始・終了
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          flushList();
          inCodeBlock = true;
          // 言語名は英数字とハイフンのみ許可（属性インジェクション防止）
          const rawLang = line.slice(3).trim();
          codeBlockLang = rawLang.replace(/[^a-zA-Z0-9\-]/g, '');
          codeLines = [];
        } else {
          inCodeBlock = false;
          const codeContent = codeLines.map(l => this.escapeHtml(l)).join('\n');
          outputParts.push(`<pre><code class="language-${codeBlockLang}">${codeContent}</code></pre>`);
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // 水平線
      if (/^---+$/.test(line.trim())) {
        flushList();
        outputParts.push('<hr>');
        continue;
      }

      // 見出し（h1 → h2 → h3 の順で判定）
      const h1 = line.match(/^# (.+)$/);
      if (h1) {
        flushList();
        outputParts.push(`<h1>${this.renderInline(h1[1])}</h1>`);
        continue;
      }
      const h2 = line.match(/^## (.+)$/);
      if (h2) {
        flushList();
        outputParts.push(`<h2>${this.renderInline(h2[1])}</h2>`);
        continue;
      }
      const h3 = line.match(/^### (.+)$/);
      if (h3) {
        flushList();
        outputParts.push(`<h3>${this.renderInline(h3[1])}</h3>`);
        continue;
      }

      // チェックリスト（- [x] / - [ ]）
      const checkDone = line.match(/^- \[x\] (.+)$/i);
      if (checkDone) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(`<li class="checklist checked">✅ ${this.renderInline(checkDone[1])}</li>`);
        continue;
      }
      const checkTodo = line.match(/^- \[ \] (.+)$/);
      if (checkTodo) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(`<li class="checklist">☐ ${this.renderInline(checkTodo[1])}</li>`);
        continue;
      }

      // 番号なしリスト（チェックリストを除外）
      const ulItem = line.match(/^- (?!\[)(.+)$/);
      if (ulItem) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(`<li>${this.renderInline(ulItem[1])}</li>`);
        continue;
      }

      // 番号付きリスト
      const olItem = line.match(/^\d+\. (.+)$/);
      if (olItem) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; }
        listItems.push(`<li>${this.renderInline(olItem[1])}</li>`);
        continue;
      }

      // 空行
      if (line.trim() === '') {
        flushList();
        continue;
      }

      // 通常の段落行
      flushList();
      outputParts.push(`<p>${this.renderInline(line)}</p>`);
    }

    // 未処理のコードブロックをフラッシュ
    if (inCodeBlock && codeLines.length > 0) {
      const codeContent = codeLines.map(l => this.escapeHtml(l)).join('\n');
      outputParts.push(`<pre><code class="language-${codeBlockLang}">${codeContent}</code></pre>`);
    }
    flushList();

    return outputParts.join('\n');
  }

  /**
   * インライン要素（太字・斜体・インラインコード・リンク）をHTMLに変換する
   * @param text - 変換するテキスト
   * @returns HTML文字列
   */
  private renderInline(text: string): string {
    // インラインコードを一時プレースホルダーに置換
    const codeMap: string[] = [];
    let remaining = text.replace(/`([^`]+)`/g, (_match, code) => {
      const idx = codeMap.length;
      codeMap.push(`<code>${this.escapeHtml(code)}</code>`);
      return `\x00CODE${idx}\x00`;
    });

    // 残りをエスケープ
    let result = this.escapeHtml(remaining);

    // 太字・斜体・リンクを適用（エスケープ後に安全な変換として処理）
    result = result
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, href) => {
        const safeHref = this.escapeHtml(this.isSafeUrl(href) ? href : '#');
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      });

    // プレースホルダーを実際のコードタグに戻す
    result = result.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeMap[parseInt(idx, 10)]);

    return result;
  }

  /**
   * Markdownファイルを読み込み、指定コンテナ要素にレンダリングして表示する
   * @param path - Markdownファイルのパス
   * @param container - 表示先のHTML要素
   */
  async display(path: string, container: HTMLElement): Promise<void> {
    container.innerHTML = '<p style="opacity:0.7;">読み込み中...</p>';
    const markdown = await this.load(path);
    container.innerHTML = this.render(markdown);
  }
}

