import { sanitizeChatHtml } from './chat-html';

describe('sanitizeChatHtml', () => {
  it('strips scripts and event handlers but keeps PS content structure', () => {
    const out = sanitizeChatHtml(
      '<div class="infobox"><script>alert(1)</script><table><tr><td onclick="x()">cell</td></tr></table></div>'
    );
    expect(out).toContain('<table>');
    expect(out).toContain('cell');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
  });

  it('keeps https backgrounds and drops styles with any other url scheme', () => {
    const kept = sanitizeChatHtml('<div style="background-image: url(https://example.com/bg.png)">x</div>');
    expect(kept).toContain('background-image');

    const dropped = sanitizeChatHtml('<div style="background-image: url(javascript:alert(1))">x</div>');
    expect(dropped).not.toContain('style=');

    const data = sanitizeChatHtml("<div style=\"background: url('data:image/png;base64,AA')\">x</div>");
    expect(data).not.toContain('style=');
  });

  it('drops stranded near-white text color so theme tokens rule', () => {
    const out = sanitizeChatHtml('<div style="color: #fff; font-style: italic">Please only talk in Hindi</div>');
    expect(out).not.toMatch(/color:/);
    expect(out).toContain('font-style: italic');
  });

  it('keeps extreme colors that bring their own backdrop', () => {
    const ownBg = sanitizeChatHtml('<div style="color:#fff;background:#223">x</div>');
    expect(ownBg).toMatch(/color:/);

    const ancestorBg = sanitizeChatHtml('<div style="background-color:#223"><span style="color:#fff">x</span></div>');
    expect(ancestorBg).toMatch(/color:\s*(#fff|rgb\(255)/);

    const midtone = sanitizeChatHtml('<span style="color:#484">Poll</span>');
    expect(midtone).toMatch(/color:/);
  });

  it('drops shadows and borders designed around a stranded color', () => {
    // A text-shadow outline over no background still ghosts on the wrong
    // surface — it does not protect the color, and it goes with it.
    const outlined = sanitizeChatHtml('<div style="color:#fff;text-shadow:1px 0 0 #000">x</div>');
    expect(outlined).not.toMatch(/color:/);
    expect(outlined).not.toContain('text-shadow');

    // text-shadow INHERITS: a wrapper-level outline must go even when the
    // extreme color lives on children, or token text gets a dark halo.
    const inherited = sanitizeChatHtml(
      '<div style="text-shadow:1px 0 0 #000"><h2 style="color:#fff">Welcome!</h2><p>subtitle</p></div>'
    );
    expect(inherited).not.toContain('text-shadow');

    const ghostButton = sanitizeChatHtml('<button style="color:#fff;border:1px solid #fff" value="/rules">Rules!</button>');
    expect(ghostButton).not.toMatch(/color:\s*(#fff|rgb\(255)/);

    const backedOutline = sanitizeChatHtml('<div style="background:#223;color:#fff;text-shadow:1px 0 0 #000">x</div>');
    expect(backedOutline).toContain('text-shadow');

    // Declared background images routinely fail to load (hotlink blocks);
    // they don't shield stranded colors the way solid colors do.
    const imageOnly = sanitizeChatHtml(
      '<div style="background-image:url(https://example.com/bg.png)"><span style="color:#fff">ghost</span></div>'
    );
    expect(imageOnly).not.toMatch(/color:\s*(#fff|rgb\(255)/);
  });

  it('keeps a wrapper color justified by contrasting descendant backgrounds', () => {
    // Tournament leaderboards declare white on the wrapper and solid navy on
    // alternating rows; stripping at the top strands those rows dark-on-dark.
    const out = sanitizeChatHtml(
      '<div style="color:#fff;text-shadow:1px 0 0 #000"><table>' +
      '<tr style="background:rgb(35,35,100)"><td>gen 9 is trash man</td></tr>' +
      '<tr style="background:rgb(80,80,110)"><td>Bekama</td></tr>' +
      '</table></div>'
    );
    expect(out).toMatch(/color:\s*(#fff|rgb\(255)/);
    expect(out).toContain('text-shadow');
  });

  it('drops a wrapper color whose only backed descendants do not contrast', () => {
    // The Cafe pattern: white wrapper text everywhere, and the only solid
    // background inside is a LIGHT button — it cannot justify white, so the
    // wrapper ghosts. Strip it; the button text goes token-colored too.
    const out = sanitizeChatHtml(
      '<div style="color:#fff"><h2>The Café</h2><p>This month\'s theme:</p>' +
      '<button style="background:#eee" value="/suggest">Suggest</button></div>'
    );
    expect(out).not.toMatch(/color:\s*(#fff|rgb\(255)/);

    // `background: none` resolves to a keyword in CSSOM — it is not a
    // surface and must not justify white links (the Cafe nav row).
    const bgNone = sanitizeChatHtml('<a href="https://x.com" style="background: none; color: white">Our website</a>');
    expect(bgNone).not.toMatch(/color:\s*white/);
  });

  it('trusts layout geometry like the official client, except fixed', () => {
    // Server HTML is vetted upstream; positioned layouts (NU's pill grid,
    // Help's bubble cluster) depend on absolute offsets and negative
    // margins surviving. Only position:fixed (escapes the block) is
    // neutralized.
    const out = sanitizeChatHtml(
      '<div style="position:relative"><div style="position:absolute;margin-top:-40px;top:10px">pill</div></div>'
    );
    expect(out).toContain('position:absolute');
    expect(out).toContain('-40px');

    const fixed = sanitizeChatHtml('<div style="position:fixed;top:0">overlay</div>');
    expect(fixed).toContain('position: static');
    expect(fixed).not.toContain('fixed');
  });

  it('normalizes font[color] the same way', () => {
    const stranded = sanitizeChatHtml('<font color="white">x</font>');
    expect(stranded).not.toContain('color');

    const backed = sanitizeChatHtml('<div bgcolor="#223"><font color="white">x</font></div>');
    expect(backed).toContain('color="white"');
  });

  it('forces safe link and button behavior', () => {
    const out = sanitizeChatHtml('<a href="https://example.com">x</a><button name="send" value="/poll vote 1">v</button>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('type="button"');
    expect(out).toContain('value="/poll vote 1"');
  });

  it('normalizes image URLs the way the official tagPolicy does', () => {
    // Protocol-relative and data:image sources are common in PS content;
    // removing them takes layout-critical banner heights with them (the
    // collapsed-intro bug). They normalize instead.
    const protoRelative = sanitizeChatHtml('<img src="//play.pokemonshowdown.com/fx/banner.png" width="500">');
    expect(protoRelative).toContain('src="https://play.pokemonshowdown.com/fx/banner.png"');

    const httpUpgrade = sanitizeChatHtml('<img src="http://example.com/a.png">');
    expect(httpUpgrade).toContain('src="https://example.com/a.png"');

    const dataImage = sanitizeChatHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(dataImage).toContain('src="data:image/png;base64');

    const rejected = sanitizeChatHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(rejected).not.toContain('<img');

    const styleProtoRelative = sanitizeChatHtml('<div style="background-image: url(//play.pokemonshowdown.com/fx/bg.png)">x</div>');
    expect(styleProtoRelative).toContain('url(https://play.pokemonshowdown.com/fx/bg.png)');

    // The Lobby banner: an empty div whose whole existence is a QUOTED https
    // background url plus a height. Regex backtracking must not reject the
    // quote and kill the style (that collapsed the intro to a sliver).
    const quoted = sanitizeChatHtml(
      '<div style="background-image:url(\'https://i.postimg.cc/rpGfkSZ2/sunset.jpg\');height:200px"></div>'
    );
    expect(quoted).toContain('sunset.jpg');
    expect(quoted).toContain('height:200px');

    const quotedEvil = sanitizeChatHtml('<div style="background-image:url(\'javascript:alert(1)\')">x</div>');
    expect(quotedEvil).not.toContain('style=');
  });

  it('restricts href/src to https without harming presentational attributes', () => {
    const out = sanitizeChatHtml(
      '<a href="ftp://example.com">dead</a><img src="ftp://example.com/x.png" alt="gone">' +
      '<table><tr><td align="right" bgcolor="#334">259</td></tr></table>'
    );
    expect(out).not.toContain('href=');
    expect(out).not.toContain('<img');
    expect(out).toContain('align="right"');
    expect(out).toContain('bgcolor="#334"');
  });
});
