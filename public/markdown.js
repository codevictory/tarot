'use strict';

// Dependency-free, XSS-safe renderer for the markdown subset used in tarot
// card descriptions. Loaded by both index.html and admin.html.
//
// Supported block syntax: ATX headings (# .. ######), unordered (-, *, +)
// and ordered (1.) lists, blockquotes (>), fenced code blocks (```),
// horizontal rules (---, ***, ___) and paragraphs. A single newline inside
// a paragraph becomes a <br>.
//
// Supported inline syntax: **bold**, *italic*, __bold__, _italic_,
// `code`, and [label](url) links. Links are limited to http:, https:,
// mailto: and scheme-less (relative) URLs.
//
// Everything is HTML-escaped first; only whitelisted tags are ever emitted,
// so raw HTML in a description can never execute.

(function (global) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Only these URL schemes may become an href; anything with another scheme
  // (javascript:, data:, vbscript:, ...) is dropped.
  function safeUrl(url) {
    const cleaned = String(url).trim();
    if (/^(https?:|mailto:)/i.test(cleaned)) return cleaned;
    if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return null;
    return cleaned; // no scheme -> relative URL, same origin
  }

  // Inline formatting. Code spans and links are stashed as placeholders
  // before the text is escaped, so the emphasis regexes can never match
  // inside a generated tag or URL.
  function renderInline(text) {
    const stash = [];
    const stashPush = (html) => '\u0000' + (stash.push(html) - 1) + '\u0000';

    let s = String(text);
    s = s.replace(/`([^`\n]+)`/g, (_, code) => stashPush('<code>' + escapeHtml(code) + '</code>'));
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      const href = safeUrl(url);
      if (!href) return match; // unsafe scheme: keep the raw markdown as text
      return stashPush(
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(label) + '</a>',
      );
    });

    s = escapeHtml(s);

    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // Underscore emphasis only between non-word characters, so snake_case
    // identifiers stay literal.
    s = s.replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, '$1<em>$2</em>');

    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[Number(n)]);
    return s;
  }

  function renderBlock(src) {
    const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    let quote = [];
    let list = null; // { tag: 'ul' | 'ol', items: string[] }
    let codeLines = null; // non-null while inside a fenced code block

    function flushPara() {
      if (para.length) {
        out.push('<p>' + para.map((line) => renderInline(line)).join('<br>') + '</p>');
        para = [];
      }
    }
    function flushQuote() {
      if (quote.length) {
        out.push('<blockquote><p>' + quote.map((line) => renderInline(line)).join('<br>') + '</p></blockquote>');
        quote = [];
      }
    }
    function closeList() {
      if (list) {
        const items = list.items.map((item) => '<li>' + renderInline(item) + '</li>').join('');
        out.push('<' + list.tag + '>' + items + '</' + list.tag + '>');
        list = null;
      }
    }
    function flushBlocks() {
      flushPara();
      flushQuote();
      closeList();
    }

    for (const line of lines) {
      if (codeLines) {
        if (/^\s*```/.test(line)) {
          out.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
          codeLines = null;
        } else {
          codeLines.push(line);
        }
        continue;
      }
      if (/^\s*```/.test(line)) {
        flushBlocks();
        codeLines = [];
        continue;
      }
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        flushBlocks();
        const level = heading[1].length;
        out.push('<h' + level + '>' + renderInline(heading[2].trim()) + '</h' + level + '>');
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flushBlocks();
        out.push('<hr>');
        continue;
      }
      const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
      const ol = /^\s*\d{1,9}[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        flushQuote();
        const tag = ul ? 'ul' : 'ol';
        if (!list || list.tag !== tag) {
          closeList();
          list = { tag, items: [] };
        }
        list.items.push((ul || ol)[1].trim());
        continue;
      }
      const quoteMatch = /^\s*>\s?(.*)$/.exec(line);
      if (quoteMatch) {
        flushPara();
        closeList();
        quote.push(quoteMatch[1]);
        continue;
      }
      if (!line.trim()) {
        flushBlocks();
        continue;
      }
      flushQuote();
      closeList();
      para.push(line);
    }
    if (codeLines) {
      // Unterminated fence: render what was collected as a code block anyway.
      out.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
    }
    flushBlocks();
    return out.join('\n');
  }

  // Strips markdown syntax, leaving plain text — used for the search
  // haystack so a query like "new beginnings" matches "**New beginnings**".
  function toPlainText(src) {
    let s = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
    s = s.replace(/```[\s\S]*?(```|$)/g, ' ');
    s = s.replace(/`([^`\n]+)`/g, '$1');
    s = s.replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1');
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    s = s.replace(/^\s*>\s?/gm, '');
    s = s.replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+/gm, '');
    s = s.replace(/(\*\*\*|\*\*|__|\*|_)/g, '');
    return s;
  }

  const api = { render: renderBlock, renderInline, toPlainText };
  global.TarotMarkdown = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
