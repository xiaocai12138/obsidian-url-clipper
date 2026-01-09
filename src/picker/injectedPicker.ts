// src/picker/injectedPicker.ts

export function buildPickerInjectedScript(enable: boolean): string {
  return `
(() => {
  // 已安装：只切换 enabled
  if (window.__URL_CLIPPER_PICKER_INSTALLED__) {
    window.__URL_CLIPPER_PICKER_ENABLED__ = ${enable ? "true" : "false"};
    console.log('[url-clipper][picker] toggle enabled=', window.__URL_CLIPPER_PICKER_ENABLED__);
    return { ok: true, installed: true, enabled: window.__URL_CLIPPER_PICKER_ENABLED__ };
  }

  window.__URL_CLIPPER_PICKER_INSTALLED__ = true;
  window.__URL_CLIPPER_PICKER_ENABLED__ = ${enable ? "true" : "false"};

  // 自检信息（宿主可读）
  window.__URL_CLIPPER_TEST__ = {
    injectedAt: Date.now(),
    enabled: window.__URL_CLIPPER_PICKER_ENABLED__,
    location: (typeof location !== 'undefined') ? location.href : ''
  };

  console.log('[url-clipper][picker] injected, enabled=', window.__URL_CLIPPER_PICKER_ENABLED__);

  // ===== Overlay 高亮框 =====
  const overlay = document.createElement('div');
  overlay.id = '__url_clipper_overlay__';
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.border = '2px solid #e5534b';
  overlay.style.background = 'rgba(229,83,75,0.10)';
  overlay.style.display = 'none';
  document.documentElement.appendChild(overlay);

  const cssEscape = (s) => {
    try { return CSS.escape(s); }
    catch (e) { return (s || '').replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'); }
  };

  const buildCssSelector = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + cssEscape(el.id);

    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();

      if (cur.id) {
        part = '#' + cssEscape(cur.id);
        parts.unshift(part);
        break;
      }

      const cls = (cur.className || '')
        .toString()
        .trim()
        .split(/\\s+/)
        .filter(Boolean);

      if (cls.length > 0) part += '.' + cls.slice(0, 2).map(cssEscape).join('.');

      const parent = cur.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (sameTag.length > 1) {
          const idx = sameTag.indexOf(cur) + 1;
          part += \`:nth-of-type(\${idx})\`;
        }
      }

      parts.unshift(part);
      cur = cur.parentElement;
      if (parts.length >= 8) break;
    }
    return parts.join(' > ');
  };

  const buildXPath = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '//*[@id="' + el.id + '"]';

    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      const tag = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (!parent) break;

      const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
      const idx = siblings.indexOf(cur) + 1;
      parts.unshift(\`/\${tag}[\${idx}]\`);
      cur = parent;

      if (parts.length >= 12) break;
    }
    return parts.length ? parts.join('') : '';
  };

  const highlight = (el) => {
    if (!el || el.nodeType !== 1) return;
    const rect = el.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';
  };

  // hover 去重
  let lastHoverEl = null;

  const onMove = (e) => {
    if (!window.__URL_CLIPPER_PICKER_ENABLED__) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay) return;

    highlight(el);

    if (el !== lastHoverEl) {
      lastHoverEl = el;

      const css = buildCssSelector(el);
      const xpath = buildXPath(el);

      // 写入 hover 状态（宿主可读）
      window.__URL_CLIPPER_LAST_HOVER__ = { css, xpath, ts: Date.now() };

      // 控制台日志
      const tag = (el.tagName || '').toLowerCase();
      const id = el.id ? ('#' + el.id) : '';
      console.log('[url-clipper][hover]', tag + id, { css, xpath });
    }
  };

  const pickElement = (el, reason) => {
    if (!el || el.nodeType !== 1) return;

    const css = buildCssSelector(el);
    const xpath = buildXPath(el);

    window.__URL_CLIPPER_LAST_PICK__ = { css, xpath, ts: Date.now(), reason };

    console.log('[url-clipper][' + reason + ']', { css, xpath });
  };

  // 单击：更新 pick（不停止选择）
  const onClick = (e) => {
    if (!window.__URL_CLIPPER_PICKER_ENABLED__) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay) return;

    pickElement(el, 'pick');
  };

  // ✅ 双击：确定并停止选择
  const onDblClick = (e) => {
    if (!window.__URL_CLIPPER_PICKER_ENABLED__) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay) return;

    // 作为最终选择
    pickElement(el, 'dblclick-confirm');

    // 停止选择
    window.__URL_CLIPPER_PICKER_ENABLED__ = false;

    // 给一个更明确的日志
    console.log('[url-clipper][picker] disabled by dblclick');
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('dblclick', onDblClick, true);

  return { ok: true, installed: true, enabled: window.__URL_CLIPPER_PICKER_ENABLED__ };
})();
`;
}
