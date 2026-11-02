/**
 * The loading animation: the cooling tray of a drum roaster seen from the front and above — a steel bowl with
 * a perforated floor, a cone in the middle and stirring arms that sweep the freshly roasted beans round and round,
 * a little steam rising off them.
 *
 * Plain SVG with SMIL animation and no dependencies: the same markup is put into index.html at build time
 * (shown while the app's script loads) and used by the React loader, so the two look the same and the switch is seamless.
 * The tray is drawn top-down and squashed vertically; the arms and beans turn inside that squash, so they move
 * along the ellipse as in perspective.
 */

const CX = 100, CY = 60, R = 76, SQ = 0.38; // floor centre, radius, vertical squash

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const f = (n: number) => n.toFixed(1);

/** beans in a ring: each a little ellipse with a crease, at a seeded radius and angle */
function beans(seed: number, n: number, rMin: number, rMax: number) {
  const rnd = seeded(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rMin + Math.sqrt(rnd()) * (rMax - rMin);
    const x = Math.cos(a) * r, y = Math.sin(a) * r, rot = rnd() * 180;
    const shade = ['#5a3218', '#6b3d1f', '#4a2812', '#7a4826'][Math.floor(rnd() * 4)];
    out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><ellipse rx="5.2" ry="3.7" fill="${shade}"/><ellipse rx="3.2" ry="1.6" cy="-1.1" fill="#fff" opacity="0.08"/><path d="M-3.9 0Q0 -1.4 3.9 0" stroke="#2a160a" stroke-width="0.9" fill="none"/></g>`;
  }
  return out;
}

/** one stirring arm: a bar from the hub with paddles standing across it */
function arm(angle: number, len: number) {
  const paddles = [0.42, 0.7, 0.93].map((t) => `<rect x="${f(len * t - 2)}" y="-7" width="4" height="14" rx="1" fill="url(#rs-paddle)"/>`).join('');
  return `<g transform="rotate(${angle})"><rect x="0" y="-2.2" width="${len}" height="4.4" rx="2.2" fill="url(#rs-bar)"/>${paddles}</g>`;
}

export function roasterSvg(): string {
  // perforated floor: a dot pattern in top-down space
  const floor = `<pattern id="rs-holes" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#2b2d30"/><circle cx="2.5" cy="2.5" r="1.15" fill="#121315"/></pattern>`;
  const defs = `<defs>
    <linearGradient id="rs-steel" x1="0" x2="1"><stop offset="0" stop-color="#8d9298"/><stop offset="0.18" stop-color="#e4e7ea"/><stop offset="0.45" stop-color="#b6bbc0"/><stop offset="0.7" stop-color="#eef0f2"/><stop offset="1" stop-color="#868b91"/></linearGradient>
    <linearGradient id="rs-inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dde0"/><stop offset="1" stop-color="#7d8288"/></linearGradient>
    <linearGradient id="rs-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f4f5"/><stop offset="1" stop-color="#9aa0a6"/></linearGradient>
    <linearGradient id="rs-paddle" x1="0" x2="1"><stop offset="0" stop-color="#c9cdd1"/><stop offset="1" stop-color="#7f858b"/></linearGradient>
    <linearGradient id="rs-cone" x1="0" x2="1"><stop offset="0" stop-color="#8f949a"/><stop offset="0.4" stop-color="#f1f3f4"/><stop offset="1" stop-color="#7a7f85"/></linearGradient>
    <linearGradient id="rs-base" x1="0" x2="1"><stop offset="0" stop-color="#1c1d1f"/><stop offset="0.5" stop-color="#333538"/><stop offset="1" stop-color="#17181a"/></linearGradient>
    ${floor}
    <clipPath id="rs-floor"><circle r="${R}"/></clipPath>
  </defs>`;
  const spin = (dur: number) => `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/>`;
  // inside the squashed floor: beans swept in two rings at different speeds, the arms faster
  const floorContent = `<g transform="translate(${CX} ${CY}) scale(1 ${SQ})">
    <circle r="${R}" fill="url(#rs-holes)"/>
    <g clip-path="url(#rs-floor)">
      <g>${spin(9)}${beans(11, 70, 34, 74)}</g>
      <g>${spin(6.5)}${beans(29, 44, 12, 50)}</g>
      <g>${spin(3.2)}${arm(0, 70)}${arm(180, 70)}${arm(90, 46)}</g>
    </g>
    <circle r="${R}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="6"/>
  </g>`;
  const rimRy = (R + 8) * SQ, floorRy = R * SQ;
  // the steel bowl: rim and inner wall behind the floor, the front wall in front of it
  const back = `<ellipse cx="${CX}" cy="${CY - 6}" rx="${R + 8}" ry="${f(rimRy)}" fill="url(#rs-inner)" stroke="#6f747a" stroke-width="1"/>`;
  const frontTop = CY - 6, depth = 22;
  const front = `<path d="M${CX - R - 8} ${frontTop} A${R + 8} ${f(rimRy)} 0 0 0 ${CX + R + 8} ${frontTop} L${CX + R + 8} ${frontTop + depth} A${R + 8} ${f(rimRy)} 0 0 1 ${CX - R - 8} ${frontTop + depth} Z" fill="url(#rs-steel)" stroke="#6f747a" stroke-width="1"/>
    <path d="M${CX - R - 8} ${frontTop} A${R + 8} ${f(rimRy)} 0 0 0 ${CX + R + 8} ${frontTop}" fill="none" stroke="#f7f8f9" stroke-width="1.6" opacity="0.8"/>`;
  // the cone and its collar stand up from the floor, so they are drawn unsquashed
  const cone = `<g transform="translate(${CX} ${CY})"><rect x="-5" y="-15" width="10" height="14" fill="url(#rs-cone)"/><path d="M-5 -15 L0 -24 L5 -15 Z" fill="url(#rs-cone)"/><ellipse cx="0" cy="-1" rx="5" ry="1.8" fill="#6f747a"/></g>`;
  // the pedestal and the discharge door at the front
  const base = `<rect x="${CX - 46}" y="${frontTop + depth + rimRy - 6}" width="92" height="34" fill="url(#rs-base)"/>
    <rect x="${CX - 16}" y="${frontTop + depth + rimRy - 8}" width="32" height="13" rx="1.5" fill="url(#rs-steel)" stroke="#6f747a" stroke-width="0.8"/>
    <path d="M${CX - 8} ${frontTop + depth + rimRy + 5} v4 h16 v-4" stroke="#b9bec3" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  // steam off the hot beans
  const steam = [-34, 4, 38].map((dx, i) => `<path d="M${CX + dx} ${CY - 2} q-5 -9 0 -18 q5 -9 0 -18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0.32;0" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 6;0 -10" dur="3s" begin="${i}s" repeatCount="indefinite"/></path>`).join('');
  void floorRy;
  return `<svg class="roaster" viewBox="0 0 200 150" width="200" height="150" role="img" aria-label="Загрузка">${defs}
    <ellipse cx="${CX}" cy="${frontTop + depth + rimRy + 30}" rx="60" ry="5" fill="rgba(0,0,0,0.18)"/>
    ${base}${back}${floorContent}${cone}${front}<g class="roaster-steam">${steam}</g></svg>`;
}
