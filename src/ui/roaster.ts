/**
 * The loading animation: a roaster's cooling tray seen from above, drawn in the same thin-line style as the brewing
 * method icons — the rim, a perforated floor (a dotted ring), the hub in the middle and two stirring arms with
 * paddles that turn round; a bean moves only when an arm reaches it and is carried a little way along.
 *
 * Plain SVG with SMIL animation and no dependencies: the same markup is put into index.html at build time
 * (shown while the app's script loads) and used by the React loader, so the switch is seamless.
 * Colors come from currentColor (the app's accent).
 */

const f = (n: number) => n.toFixed(2);

const T = 2.6;             // one turn of the arms, s
const W = 360 / T;         // their angular speed, °/s
const REACH = 10.9;        // the arms reach this far from the hub; beans beyond them are never touched
const PADDLES = [5.5, 9.2];

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/**
 * A bean lies still until an arm comes round to it; the arm then carries it a little way along and leaves it.
 * A paddle shoves harder than the bare bar, and beans out of the arms' reach never move. Two arms half a turn apart
 * give one push every half turn: a repeating cycle «push Δ, then rest», summed up (accumulate) from cycle to cycle.
 */
function bean(a: number, r: number, turn: number) {
  const body = `<g transform="translate(${f(r)} 0) rotate(${f(turn)})"><ellipse rx="1.45" ry="1" fill="currentColor" stroke="none"/><path d="M-1 0.12Q0 -0.42 1 0.12" stroke="var(--loader-bg, #fff)" stroke-width="0.4"/></g>`;
  if (r > REACH) return `<g transform="rotate(${f(a)})">${body}</g>`;
  const paddle = PADDLES.some((p) => Math.abs(p - r) < 1.1);
  const push = paddle ? 26 : 9;                       // degrees per pass
  const half = T / 2, moving = push / W;              // s
  const first = (((a % 180) + 180) % 180) / W;        // when an arm first reaches it
  const move = `<animateTransform attributeName="transform" type="rotate" values="0;${push};${push}" keyTimes="0;${f(moving / half)};1"
    dur="${f(half)}s" begin="${f(first)}s" repeatCount="indefinite" accumulate="sum" calcMode="spline" keySplines="0.2 0 0.4 1;0 0 1 1"/>`;
  return `<g transform="rotate(${f(a)})"><g>${move}${body}</g></g>`;
}

/** beans spread over the floor without touching each other */
function scatter(n: number) {
  const rnd = seeded(7), out: [number, number, number][] = [];
  for (let k = 0; out.length < n && k < 4000; k++) {
    const r = 3.6 + Math.sqrt(rnd()) * 7.9, a = rnd() * 360;
    const x = Math.cos((a * Math.PI) / 180) * r, y = Math.sin((a * Math.PI) / 180) * r;
    if (out.some(([b, q]) => Math.hypot(Math.cos((b * Math.PI) / 180) * q - x, Math.sin((b * Math.PI) / 180) * q - y) < 2.7)) continue;
    out.push([a, r, rnd() * 180]);
  }
  return out;
}

/** an arm from the hub to the rim with two paddles across it */
function arm(angle: number) {
  return `<g transform="rotate(${angle} 16 16)"><path d="M18.2 16H26.6"/><path d="M21.5 14.6v2.8M25.2 14.4v3.2"/></g>`;
}

export function roasterSvg(): string {
  const spin = (dur: number) => `<animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="${dur}s" repeatCount="indefinite"/>`;
  const beans = scatter(30).map(([a, r, k]) => bean(a, r, k)).join('');
  return `<svg class="roaster" viewBox="0 0 32 32" width="64" height="64" role="img" aria-label="Загрузка" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="13.6"/>
    <circle cx="16" cy="16" r="11.6" stroke-width="0.9" stroke-dasharray="0.01 2.05" opacity="0.45"/>
    <g transform="translate(16 16)">${beans}</g>
    <g>${spin(T)}${arm(0)}${arm(180)}</g>
    <circle cx="16" cy="16" r="2.2"/>
  </svg>`;
}
