import DOMPurify from 'dompurify';

/**
 * Sanitizer for server-sent chat HTML (|raw|, |html|, |uhtml|, /raw-style
 * chat directives): room intros, polls, tour cards, bot leaderboards.
 *
 * The allowlist admits what real PS content uses — tables, images, fonts,
 * command buttons, inline styles with https backgrounds — while refusing
 * scripts, frames, forms, event handlers and non-https URLs.
 *
 * Server content is authored against the official client's surfaces and
 * often pairs `color: #fff` with its own background image or a text-shadow
 * outline. When it doesn't — white text with no backdrop of its own — that
 * text is invisible on our light theme, so a normalization pass strips
 * extreme inline colors from elements with no self/ancestor backdrop and
 * lets the theme's text color rule.
 */

const PURIFY_OPTIONS = {
  ALLOWED_TAGS: [
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike', 'code', 'pre',
    'br', 'p', 'div', 'span', 'small', 'big', 'sup', 'sub', 'font',
    'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr',
    'td', 'th', 'summary', 'details', 'center', 'hr', 'img', 'button',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'abbr',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'src', 'alt', 'width', 'height',
    'style', 'align', 'valign', 'colspan', 'rowspan', 'border', 'cellpadding',
    'cellspacing', 'color', 'size', 'face', 'bgcolor', 'name', 'value', 'class',
  ],
  // NOTE: no custom ALLOWED_URI_REGEXP — DOMPurify applies it to EVERY
  // attribute outside its URI-safe set, so a strict one silently strips
  // bgcolor="#223", align="right" and friends. The default already blocks
  // dangerous schemes; the hook below tightens href/src to https.
  ALLOW_DATA_ATTR: false,
};

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) node.removeAttribute('href');
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  // Buttons stay inert form-wise; clicks are delegated to the room's command
  // sender (polls, /join buttons).
  if (node.tagName === 'BUTTON') node.setAttribute('type', 'button');
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(src)) {
      node.remove();
      return;
    }
    node.setAttribute('loading', 'lazy');
  }
  // Inline styles may fetch https images (same reach as <img src>), but no
  // other scheme, and no CSS escape hatches.
  const style = node.getAttribute('style');
  if (style && (
    /expression\s*\(|@import|behavior\s*:/i.test(style) ||
    /url\s*\(\s*['"]?(?!https:\/\/)/i.test(style)
  )) {
    node.removeAttribute('style');
  }
});

/** Perceived luminance of an inline color; null when unparsable. */
const luminance = (value: string): number | null => {
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return (0.299 * Number(rgb[1]) + 0.587 * Number(rgb[2]) + 0.114 * Number(rgb[3])) / 255;
  }
  const hex = value.match(/^#([0-9a-f]{3}(?:[0-9a-f]{3})?)$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g) as string[];
    const [r, g, b] = digits.map(pair => parseInt(pair, 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  if (/^white$/i.test(value)) return 1;
  if (/^black$/i.test(value)) return 0;
  return null;
};

const isExtreme = (value: string): boolean => {
  const level = luminance(value);
  return level !== null && (level > 0.82 || level < 0.18);
};

/**
 * Does this element bring its own readable base? Only solid background
 * colors count. Declared background images don't — third-party image hosts
 * routinely block hotlinking from non-official origins, and a text-shadow
 * outline over a missing background still ghosts — so neither protects.
 */
const hasBackdrop = (start: HTMLElement): boolean => {
  for (let node: HTMLElement | null = start; node; node = node.parentElement) {
    const color = node.style.backgroundColor;
    if (color && color !== 'transparent' && !/^rgba\([^)]+,\s*0\s*\)$/i.test(color)) return true;
    if (node.hasAttribute('bgcolor')) return true;
  }
  return false;
};

export const sanitizeChatHtml = (html: string): string => {
  const fragment = DOMPurify.sanitize(html, { ...PURIFY_OPTIONS, RETURN_DOM_FRAGMENT: true });

  // Near-white/near-black inline text with no backdrop of its own was
  // authored for a surface we don't render; drop it (and the shadow that
  // was designed around it) so tokens decide. Same for extreme borders.
  for (const el of fragment.querySelectorAll<HTMLElement>('[style]')) {
    if (hasBackdrop(el)) continue;
    const color = el.style.color;
    if (color && isExtreme(color)) {
      el.style.color = '';
      el.style.textShadow = '';
    }
    const border = el.style.borderColor;
    if (border && isExtreme(border)) el.style.borderColor = '';
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  }
  for (const el of fragment.querySelectorAll<HTMLElement>('font[color]')) {
    const color = el.getAttribute('color') || '';
    if (isExtreme(color) && !hasBackdrop(el)) el.removeAttribute('color');
  }

  const holder = document.createElement('div');
  holder.appendChild(fragment);
  return holder.innerHTML;
};
