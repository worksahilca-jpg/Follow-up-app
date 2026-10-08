(() => {
  const px = v => Math.round(parseFloat(v) || 0);
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const font = el => { const s = getComputedStyle(el); return `${s.fontFamily.split(',')[0].replace(/["']/g, '')} ${px(s.fontSize)}px lh${s.lineHeight === 'normal' ? 'normal' : px(s.lineHeight)} w${s.fontWeight} ls${s.letterSpacing} ${s.color}`; };
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const out = { url: location.href, viewport: innerWidth + 'x' + innerHeight, pageHeight: docH, screens: +(docH / innerHeight).toFixed(1) };
  const seen = [], sections = [];
  for (const el of document.querySelectorAll('header, nav, section, footer, main > div, body > div > div')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 160 || r.width < innerWidth * 0.5) continue;
    if (seen.some(o => o.contains(el) && Math.abs(o.getBoundingClientRect().height - r.height) < 40)) continue;
    seen.push(el);
    const s = getComputedStyle(el), h = el.querySelector('h1, h2, h3'), p = el.querySelector('p');
    const b = el.querySelector('a[class*=btn], a[class*=utton], button, [role=button]'), bs = b && getComputedStyle(b);
    sections.push({
      top: px(r.top + scrollY), height: px(r.height), bg: s.backgroundColor,
      bgImage: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 90) : '',
      padY: `${px(s.paddingTop)}/${px(s.paddingBottom)}`, radius: s.borderRadius,
      heading: h ? { text: h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70), font: font(h) } : null,
      body: p ? font(p) : null,
      button: b ? { text: b.textContent.trim().slice(0, 30), bg: bs.backgroundColor, radius: bs.borderRadius, pad: `${px(bs.paddingTop)} ${px(bs.paddingLeft)}`, font: font(b) } : null,
      media: { img: el.querySelectorAll('img').length, video: el.querySelectorAll('video').length, canvas: el.querySelectorAll('canvas').length }
    });
  }
  out.sections = sections.sort((a, b) => a.top - b.top).slice(0, 40);
  const widths = {};
  document.querySelectorAll('div, section, main').forEach(el => { const m = getComputedStyle(el).maxWidth; if (m.endsWith('px')) widths[m] = (widths[m] || 0) + 1; });
  out.maxWidths = Object.entries(widths).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const all = [...document.querySelectorAll('*')];
  out.stickyOrFixed = all.filter(el => /sticky|fixed/.test(getComputedStyle(el).position) && vis(el)).slice(0, 10).map(el => `${el.tagName.toLowerCase()} ${getComputedStyle(el).position} h${px(el.getBoundingClientRect().height)}`);
  const tr = {}, an = {};
  all.forEach(el => {
    const s = getComputedStyle(el);
    if (s.transitionDuration !== '0s') { const k = `${s.transitionProperty.slice(0, 40)} | ${s.transitionDuration} | ${s.transitionTimingFunction}`; tr[k] = (tr[k] || 0) + 1; }
    if (s.animationName !== 'none') { const k = `${s.animationName} | ${s.animationDuration} | ${s.animationTimingFunction} | ${s.animationIterationCount}`; an[k] = (an[k] || 0) + 1; }
  });
  out.transitions = Object.entries(tr).sort((a, b) => b[1] - a[1]).slice(0, 12);
  out.cssAnimations = Object.entries(an).sort((a, b) => b[1] - a[1]).slice(0, 12);
  out.runningAnimations = document.getAnimations ? document.getAnimations().length : 'n/a';
  out.libraries = ['gsap', 'ScrollTrigger', 'Lenis', 'lenis', 'THREE', 'lottie', 'rive', 'Spline'].filter(k => k in window);
  out.fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight} ${f.style}`))].slice(0, 20);
  const txt = JSON.stringify(out, null, 1);
  console.log(txt);
  return txt;
})();
