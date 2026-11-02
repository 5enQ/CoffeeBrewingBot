/**
 * The loading animation: a roaster's cooling tray seen from above, drawn in the same thin-line style as the brewing
 * method icons — the rim, a perforated floor (a dotted ring), the hub in the middle and two stirring arms with
 * paddles that turn round, sweeping a few beans along behind them.
 *
 * Plain SVG with SMIL animation and no dependencies: the same markup is put into index.html at build time
 * (shown while the app's script loads) and used by the React loader, so the switch is seamless.
 * Colors come from currentColor (the app's accent).
 */

const f = (n: number) => n.toFixed(2);

/** a bean lying on the floor at angle a (degrees) and radius r, turned along its way */
function bean(a: number, r: number, turn: number) {
  const t = (a * Math.PI) / 180, x = 16 + Math.cos(t) * r, y = 16 + Math.sin(t) * r;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a + turn)})"><ellipse rx="1.75" ry="1.2" fill="currentColor" stroke="none"/><path d="M-1.2 0.15Q0 -0.5 1.2 0.15" stroke="var(--loader-bg, #fff)" stroke-width="0.45"/></g>`;
}

/** an arm from the hub to the rim with two paddles across it */
function arm(angle: number) {
  return `<g transform="rotate(${angle} 16 16)"><path d="M18.2 16H26.6"/><path d="M21.5 14.6v2.8M25.2 14.4v3.2"/></g>`;
}

export function roasterSvg(): string {
  const spin = (dur: number) => `<animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="${dur}s" repeatCount="indefinite"/>`;
  const beans = [[20, 8.2, 70], [95, 10.4, 20], [160, 7.4, 110], [235, 9.6, 40], [300, 11.3, 90], [340, 6.6, 0]].map(([a, r, k]) => bean(a, r, k)).join('');
  return `<svg class="roaster" viewBox="0 0 32 32" width="64" height="64" role="img" aria-label="Загрузка" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="13.6"/>
    <circle cx="16" cy="16" r="11.6" stroke-width="0.9" stroke-dasharray="0.01 2.05" opacity="0.45"/>
    <g>${spin(5.2)}${beans}</g>
    <g>${spin(2.6)}${arm(0)}${arm(180)}</g>
    <circle cx="16" cy="16" r="2.2"/>
  </svg>`;
}
