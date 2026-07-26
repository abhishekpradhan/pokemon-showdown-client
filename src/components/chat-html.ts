import DOMPurify from 'dompurify';

/**
 * Sanitizer for server-sent chat HTML (|raw|, |html|, |uhtml|, /raw-style
 * chat directives): room intros, polls, tour cards, bot leaderboards.
 *
 * The allowlist admits what real PS content uses — tables, images, fonts,
 * command buttons, inline styles with https backgrounds — while refusing
 * scripts, frames, forms, event handlers and non-https URLs. Layout
 * geometry is trusted the way the official client trusts it (Caja passes
 * it through; the server vets room HTML); only position:fixed is refused.
 *
 * Server content is authored against the official client's surfaces and
 * often uses extreme colors (white text) that depend on a backdrop we may
 * not render. The normalization pass keeps an extreme color only when text
 * inheriting it sits over a solid background it contrasts with, and drops
 * it — with its text-shadow — otherwise, so theme tokens rule.
 *
 * All style reads/writes work on the style ATTRIBUTE text, not CSSOM:
 * engines disagree on shorthand expansion (jsdom chokes on
 * `background: none`), and the attribute is the one source of truth.
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
  // other scheme, and no CSS escape hatches. Only fixed positioning (which
  // escapes the block) is neutralized.
  const style = node.getAttribute('style');
  if (style) {
    if (
      /expression\s*\(|@import|behavior\s*:/i.test(style) ||
      /url\s*\(\s*['"]?(?!https:\/\/)/i.test(style)
    ) {
      node.removeAttribute('style');
    } else if (/position\s*:\s*fixed/i.test(style)) {
      node.setAttribute('style', style.replace(/position\s*:\s*fixed/gi, 'position: static'));
    }
  }
});

// ── Attribute-text style access (engine-independent) ────────────────────────

const readDeclaration = (el: Element, property: string): string => {
  const source = el.getAttribute('style') || '';
  const match = source.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
};

const stripDeclaration = (el: Element, property: string): void => {
  const source = el.getAttribute('style') || '';
  const next = source.replace(new RegExp(`(?:^|;)\\s*${property}\\s*:[^;]*`, 'gi'), '').trim();
  if (next.replace(/;/g, '').trim()) el.setAttribute('style', next);
  else el.removeAttribute('style');
};

/** Perceived luminance of a color value; null when unparsable. */
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

const CSS_NON_COLOR_WORD = /^(?:transparent|initial|inherit|unset|revert|none|repeat(?:-[xy])?|no-repeat|space|round|center|top|bottom|left|right|cover|contain|fixed|scroll|local|border-box|padding-box|content-box|url)$/i;

/**
 * Solid background luminance declared on this element, or null. Reads
 * `background-color` and the `background` shorthand's color component;
 * gradients and url() images don't count — third-party hosts routinely
 * block hotlinking, so an image is never a guaranteed surface.
 */
const backgroundLuminance = (el: Element): number | null => {
  const explicit = readDeclaration(el, 'background-color');
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  const shorthand = readDeclaration(el, 'background');
  if (shorthand) {
    const withoutFunctions = shorthand.replace(/url\s*\([^)]*\)|[a-z-]*gradient\s*\([^)]*\)/gi, ' ');
    const tokens = withoutFunctions.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z-]+/gi) || [];
    candidates.push(...tokens);
  }
  if (el.hasAttribute('bgcolor')) candidates.push(el.getAttribute('bgcolor') || '');
  for (const token of candidates) {
    if (!token || CSS_NON_COLOR_WORD.test(token)) continue;
    if (/^rgba\([^)]+,\s*0\s*\)$/i.test(token)) continue;
    const level = luminance(token);
    if (level !== null) return level;
    // Named color we can't parse (navy, wheat…): solid, assume mid-tone.
    if (/^[a-z]+$/i.test(token)) return 0.5;
  }
  return null;
};

/** Nearest solid background luminance walking up from `start`. */
const chainBackground = (start: HTMLElement): number | null => {
  for (let node: HTMLElement | null = start; node; node = node.parentElement) {
    const level = backgroundLuminance(node);
    if (level !== null) return level;
  }
  return null;
};

/**
 * An extreme inline color is JUSTIFIED when some text inheriting it sits
 * over a solid background it contrasts with — a leaderboard's wrapper-level
 * white is justified by its navy rows. It is NOT justified by same-side
 * backgrounds (a white button under a white wrapper color) or by background
 * images.
 */
const colorIsJustified = (declaration: HTMLElement): boolean => {
  const level = luminance(readDeclaration(declaration, 'color'));
  if (level === null) return true;
  const inheritors = [declaration, ...declaration.querySelectorAll<HTMLElement>('*')]
    .filter(el => el === declaration || !readDeclaration(el, 'color'))
    .filter(el => [...el.childNodes].some(node => node.nodeType === 3 && (node.textContent || '').trim().length > 0));
  for (const el of inheritors) {
    const bg = chainBackground(el);
    if (bg !== null && Math.abs(bg - level) >= 0.35) return true;
  }
  return false;
};

/** Ancestor-only solid backdrop — for stray shadow/border declarations. */
const hasBackdrop = (start: HTMLElement): boolean => chainBackground(start) !== null;

export const sanitizeChatHtml = (html: string): string => {
  const fragment = DOMPurify.sanitize(html, { ...PURIFY_OPTIONS, RETURN_DOM_FRAGMENT: true });

  // Keep an extreme color only when contrast-justified; otherwise drop it
  // and the text-shadow designed around it (shadows INHERIT — left in place
  // they wrap token-colored descendants in a dark halo). Stray shadows and
  // extreme borders with no ancestor backdrop go the same way.
  for (const el of fragment.querySelectorAll<HTMLElement>('[style]')) {
    const color = readDeclaration(el, 'color');
    const extreme = !!color && isExtreme(color);
    const justified = extreme && colorIsJustified(el);
    if (extreme && !justified) {
      stripDeclaration(el, 'color');
      stripDeclaration(el, 'text-shadow');
    }
    if (!justified && !hasBackdrop(el)) {
      if (readDeclaration(el, 'text-shadow')) stripDeclaration(el, 'text-shadow');
      const borderColor = readDeclaration(el, 'border-color');
      if (borderColor && isExtreme(borderColor)) stripDeclaration(el, 'border-color');
      const border = readDeclaration(el, 'border');
      const borderToken = border.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|\bwhite\b|\bblack\b/i)?.[0];
      if (borderToken && isExtreme(borderToken)) {
        el.setAttribute('style', (el.getAttribute('style') || '').replace(borderToken, 'currentcolor'));
      }
    }
  }
  for (const el of fragment.querySelectorAll<HTMLElement>('font[color]')) {
    const color = el.getAttribute('color') || '';
    if (isExtreme(color) && !hasBackdrop(el)) el.removeAttribute('color');
  }

  const holder = document.createElement('div');
  holder.appendChild(fragment);
  return holder.innerHTML;
};
