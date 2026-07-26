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

  it('keeps a wrapper color that backgrounded descendants inherit', () => {
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

  it('flattens overlay layouts that depend on unreliable image geometry', () => {
    const out = sanitizeChatHtml(
      '<div style="height:200px"></div>' +
      '<div style="position:absolute;margin-top:-200px">READ THE ROOM RULES!</div>'
    );
    expect(out).toContain('position: static');
    expect(out).not.toContain('-200px');
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

  it('restricts href/src to https without harming presentational attributes', () => {
    const out = sanitizeChatHtml(
      '<a href="ftp://example.com">dead</a><img src="data:image/png;base64,AA" alt="gone">' +
      '<table><tr><td align="right" bgcolor="#334">259</td></tr></table>'
    );
    expect(out).not.toContain('href=');
    expect(out).not.toContain('<img');
    expect(out).toContain('align="right"');
    expect(out).toContain('bgcolor="#334"');
  });
});
