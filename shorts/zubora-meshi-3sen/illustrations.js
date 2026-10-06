// 画像はすべてこのファイルのコードで描いています（外部の写真・イラスト素材は使っていません）。
// 1枚 = 940x480 のカード。ILLUST.svg(id) が SVG 文字列を返します。
(function () {
  const C = {
    ink: '#3B2A20', white: '#FFFFFF', red: '#E53935', orange: '#FF7A1A',
    yolk: '#FFB000', yolkHi: '#FFE7A0',
    noodle: '#FFF6DE', noodleLine: '#E2C98F',
    tsuyu: '#97461A',
    bowl: '#2F5DA8', bowlIn: '#F3E7D3',
    chawan: '#FFFFFF', chawanBand: '#3E6FB8',
    takikomi: '#E8BE84', grainHi: '#F8E6C2', grainLo: '#CF9C5C',
    saba: '#BCA28A', sabaSkin: '#5E6C7B',
    pasta: '#F7CD55', pastaLine: '#D9A327',
    tuna: '#F0D5B2', tunaLine: '#C99A6A', nori: '#263529',
    plate: '#FFFFFF', plateRim: '#86B9E8', plateIn: '#F3F5F7',
    steam: '#CBBDB0', sparkle: '#FFC21A',
    mw: '#F1ECE3', mwWin: '#2E3742', mwGlow: '#FFDB8A', mwPanel: '#DCD4C7', lcd: '#23402F', lcdOn: '#8EF0A0',
    board: '#EDBB7A', boardGrain: '#CF9550', steel: '#D6DEE6', steelEdge: '#9FADBA', handle: '#5A3A24',
    can: '#D9DFE5', canTop: '#EEF2F5', sabaLabel: '#2A7BD0', tunaLabel: '#EE9A1A',
    bottle: '#5C2C0E', cap: '#E2402F', labelPaper: '#FFF4D8',
    rice: '#FFFBF0', riceGrain: '#E6D7B5', water: 'rgba(205,150,90,0.32)', waterLine: '#C0762F',
    potWall: '#AEB9C3', potIn: '#EEF2F5',
    pack: '#DDF0FF', packBand: '#2A7BD0',
    phone: '#2E3742', screen: '#FFF3DF', moon: '#FFD54A', night: '#3B4C7A', pink: '#E8337D', blue: '#1E6FE8',
  };
  const SW = 7;
  const W = 940, H = 480;

  // ---------------------------------------------------------------- 小道具
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function rng(seed) { // 毎回同じ並びになる乱数（描き直しても絵が変わらない）
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function curve(pts, closed = true) { // 点列をなめらかに結ぶ
    const n = pts.length; let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const q0 = closed || i > 0 ? p0 : p1, q3 = closed || i + 2 < n ? p3 : p2;
      const c1 = [p1[0] + (p2[0] - q0[0]) / 6, p1[1] + (p2[1] - q0[1]) / 6];
      const c2 = [p2[0] - (q3[0] - p1[0]) / 6, p2[1] - (q3[1] - p1[1]) / 6];
      d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return closed ? d + 'Z' : d;
  }

  function blob(cx, cy, r, vars, squash = 0.9, rot = 0) {
    const n = vars.length;
    return curve(vars.map((v, i) => {
      const a = rot + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v * squash];
    }));
  }

  // [赤字] で一部を強調できるテキスト
  function txt(x, y, s, size, fill, o = {}) {
    const parts = String(s).split(/(\[[^\]]+\])/).filter(Boolean).map((p) =>
      p.startsWith('[') ? `<tspan fill="${C.red}">${esc(p.slice(1, -1))}</tspan>` : esc(p)).join('');
    const stroke = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 8}" paint-order="stroke" stroke-linejoin="round"` : '';
    return `<text class="lbl" x="${f1(x)}" y="${f1(y)}" font-size="${size}" fill="${fill}" text-anchor="${o.anchor || 'middle'}" dominant-baseline="central" font-weight="${o.weight || 800}"${stroke}>${parts}</text>`;
  }

  // 文字に合わせて枠の大きさが決まる札（大きさは描画時に実測して合わせる）
  function tag(x, y, s, o = {}) {
    return `<g class="tag" data-pad="${o.pad || 14}"><rect rx="${o.rx || 14}" fill="${o.fill || C.white}" stroke="${C.ink}" stroke-width="5"/>` +
      txt(x, y, s, o.size || 30, o.color || C.ink, { anchor: o.anchor || 'middle', weight: o.weight }) + '</g>';
  }

  // 右側の手順リスト（どの「作り方」カードも同じ形）
  function steps(x, items, o = {}) {
    const size = o.size || 32, lh = o.lh || 42, gap = o.gap || 24, r = 25;
    const hs = items.map((it) => it.split('\n').length * lh);
    let y = (H - (hs.reduce((a, b) => a + b, 0) + gap * (items.length - 1))) / 2;
    let s = '';
    items.forEach((it, i) => {
      const cy = y + lh / 2;
      s += `<circle cx="${x + r}" cy="${f1(cy)}" r="${r}" fill="${C.orange}" stroke="${C.ink}" stroke-width="5"/>`;
      s += txt(x + r, cy + 1, String(i + 1), 30, C.white, { weight: 900 });
      it.split('\n').forEach((ln, j) => { s += txt(x + 2 * r + 16, cy + j * lh, ln, size, C.ink, { anchor: 'start' }); });
      y += hs[i] + gap;
    });
    return s;
  }

  function steam(cx, bottom, h = 70, gap = 48) {
    let s = '';
    [-1, 0, 1].forEach((k) => {
      const x = cx + k * gap, hh = k === 0 ? h * 1.15 : h;
      s += `<path d="M${x},${bottom} c-16,${-hh / 6} 16,${-hh / 3} 0,${-hh / 2} s16,${-hh / 3} 0,${-hh / 2}" fill="none" stroke="${C.steam}" stroke-width="9" stroke-linecap="round"/>`;
    });
    return s;
  }

  function sparkle(cx, cy, r) {
    const k = r * 0.28;
    return `<path d="M${cx},${cy - r} Q${cx + k},${cy - k} ${cx + r},${cy} Q${cx + k},${cy + k} ${cx},${cy + r} Q${cx - k},${cy + k} ${cx - r},${cy} Q${cx - k},${cy - k} ${cx},${cy - r}Z" fill="${C.sparkle}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>`;
  }

  // 効果文字（チン！など）
  function sfx(x, y, s, size = 54, rot = -8) {
    return `<g transform="rotate(${rot} ${x} ${y})">${txt(x, y, s, size, C.orange, { stroke: C.ink, sw: 10, weight: 900 })}</g>`;
  }

  const g = (inner, tx = 0, ty = 0, sc = 1) => `<g transform="translate(${tx} ${ty}) scale(${sc})">${inner}</g>`;

  // ---------------------------------------------------------------- 器と料理（原点 = 器のふち中央）

  function bowlShape(R, D, color, band) {
    const ry = R * 0.2;
    const body = `M${-R},0 C${-R},${D * 0.78} ${-R * 0.56},${D} ${-R * 0.4},${D} L${R * 0.4},${D} C${R * 0.56},${D} ${R},${D * 0.78} ${R},0 Z`;
    return {
      back: `<rect x="${-R * 0.34}" y="${D - 8}" width="${R * 0.68}" height="${R * 0.12 + 10}" rx="8" fill="${color}" stroke="${C.ink}" stroke-width="${SW}"/>` +
        `<path d="${body}" fill="${color}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>` +
        `<path d="M${-R * 0.94},${D * 0.3} Q0,${D * 0.46} ${R * 0.94},${D * 0.3}" fill="none" stroke="${band}" stroke-width="${Math.max(8, R * 0.06)}" stroke-linecap="round"/>` +
        `<ellipse cx="0" cy="0" rx="${R}" ry="${ry}" fill="${C.bowlIn}" stroke="${C.ink}" stroke-width="${SW}"/>`,
      lip: `<path d="M${-R},0 A${R},${ry} 0 0 0 ${R},0" fill="none" stroke="${C.ink}" stroke-width="${SW}"/>`,
    };
  }

  function udonBowl(R = 210) { // 釜玉風うどん
    const D = R * 0.8, ry = R * 0.2, b = bowlShape(R, D, C.bowl, '#FFFFFF');
    const top = -ry * 3.1;
    const mound = `M${-R * 0.9},2 C${-R * 0.78},${top} ${R * 0.78},${top} ${R * 0.9},2 Z`;
    const clip = 'udon' + Math.round(R);
    let food = `<ellipse cx="0" cy="0" rx="${R * 0.93}" ry="${ry * 0.82}" fill="${C.noodle}"/>`;
    food += `<clipPath id="${clip}"><path d="${mound}"/></clipPath>`;
    food += `<path d="${mound}" fill="${C.noodle}"/>`;
    // 太い麺（輪郭付き）を山なりに重ねる
    const nw = Math.max(9, R * 0.075);
    let strands = '';
    const rnd = rng(7);
    for (let k = 0; k < 8; k++) {
      const t = k / 7, y0 = -2 - t * (-top) * 0.78;
      const half = R * 0.92 * Math.sqrt(1 - t * 0.9);
      const lift = top * (0.32 - t * 0.12) * (0.8 + rnd() * 0.4), sway = (rnd() - 0.5) * R * 0.5;
      const d = `M${f1(-half)},${f1(y0 + 6)} Q${f1(sway)},${f1(y0 + lift)} ${f1(half)},${f1(y0 + 6)}`;
      strands += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(nw + 7)}" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${C.noodle}" stroke-width="${f1(nw)}" stroke-linecap="round"/>`;
    }
    food += `<g clip-path="url(#${clip})">${strands}</g>`;
    food += `<path d="${mound}" fill="none" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    // めんつゆ
    food += `<path d="M${-R * 0.62},${top * 0.32} q${R * 0.12},${-R * 0.08} ${R * 0.24},0 t${R * 0.24},0" fill="none" stroke="${C.tsuyu}" stroke-width="9" stroke-linecap="round" opacity="0.8"/>`;
    food += `<path d="M${R * 0.25},${top * 0.25} q${R * 0.1},${-R * 0.07} ${R * 0.2},0 t${R * 0.2},0" fill="none" stroke="${C.tsuyu}" stroke-width="9" stroke-linecap="round" opacity="0.8"/>`;
    // 卵
    const ex = R * 0.02, ey = top * 0.6;
    food += `<path d="${blob(ex + R * 0.03, ey + R * 0.02, R * 0.3, [1.15, 0.8, 0.95, 1.2, 0.75, 1.05, 0.9, 1.1, 0.85], 0.55, 0.4)}" fill="rgba(255,255,255,0.88)" stroke="#E6D6B0" stroke-width="4" stroke-linejoin="round"/>`;
    food += `<ellipse cx="${ex}" cy="${ey}" rx="${R * 0.17}" ry="${R * 0.15}" fill="${C.yolk}" stroke="${C.ink}" stroke-width="${SW}"/>`;
    food += `<ellipse cx="${ex - R * 0.06}" cy="${ey - R * 0.05}" rx="${R * 0.05}" ry="${R * 0.03}" fill="${C.yolkHi}"/>`;
    return b.back + food + b.lip;
  }

  function riceBowl(R = 190) { // サバ缶炊き込みご飯
    const D = R * 0.78, ry = R * 0.2, b = bowlShape(R, D, C.chawan, C.chawanBand);
    const top = -ry * 3.0;
    let food = `<ellipse cx="0" cy="0" rx="${R * 0.93}" ry="${ry * 0.82}" fill="${C.takikomi}"/>`;
    food += `<path d="M${-R * 0.92},2 C${-R * 0.8},${top} ${R * 0.8},${top} ${R * 0.92},2 Z" fill="${C.takikomi}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    const rnd = rng(11);
    for (let k = 0; k < 70; k++) { // ごはん粒
      const t = rnd() * 2 - 1, u = rnd();
      const x = t * R * 0.8, yMax = top * 0.75 * (1 - t * t);
      const y = -6 + u * yMax;
      food += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(R * 0.04)}" ry="${f1(R * 0.022)}" transform="rotate(${Math.round(rnd() * 180)} ${f1(x)} ${f1(y)})" fill="${rnd() < 0.7 ? C.grainHi : C.grainLo}"/>`;
    }
    [[-0.38, 0.45, 0.17, 20], [0.12, 0.62, 0.2, -15], [0.45, 0.32, 0.15, 35], [-0.08, 0.3, 0.13, -40]].forEach(([px, py, s, rot], i) => {
      const x = px * R, y = top * py, w = s * R;
      food += `<g transform="rotate(${rot} ${f1(x)} ${f1(y)})"><path d="${blob(x, y, w, [1, 0.8, 1.1, 0.9, 1.05, 0.75], 0.62, i)}" fill="${C.saba}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M${f1(x - w * 0.8)},${f1(y - w * 0.32)} Q${f1(x)},${f1(y - w * 0.62)} ${f1(x + w * 0.8)},${f1(y - w * 0.32)}" fill="none" stroke="${C.sabaSkin}" stroke-width="8" stroke-linecap="round"/></g>`;
    });
    return b.back + food + b.lip;
  }

  function pastaPlate(rx = 320) { // ツナパスタ（原点 = 皿の中心）
    const ry = rx * 0.37;
    let s = `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${C.plate}" stroke="${C.ink}" stroke-width="${SW}"/>`;
    s += `<ellipse cx="0" cy="0" rx="${rx * 0.9}" ry="${ry * 0.86}" fill="none" stroke="${C.plateRim}" stroke-width="6"/>`;
    s += `<ellipse cx="0" cy="${ry * 0.04}" rx="${rx * 0.7}" ry="${ry * 0.66}" fill="${C.plateIn}"/>`;
    const nest = `M${-rx * 0.62},${ry * 0.25} C${-rx * 0.66},${-ry * 1.25} ${rx * 0.66},${-ry * 1.25} ${rx * 0.62},${ry * 0.25} Q0,${ry * 0.62} ${-rx * 0.62},${ry * 0.25}Z`;
    s += `<clipPath id="nest${Math.round(rx)}"><path d="${nest}"/></clipPath>`;
    s += `<path d="${nest}" fill="${C.pasta}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    let strands = '';
    const rnd = rng(5);
    for (let k = 0; k < 16; k++) {
      const cx = (rnd() - 0.5) * rx * 0.9, cy = -ry * 0.2 + (rnd() - 0.5) * ry * 0.9, a = rx * (0.15 + rnd() * 0.25);
      strands += `<path d="M${f1(cx - a)},${f1(cy)} C${f1(cx - a)},${f1(cy - a * 0.55)} ${f1(cx + a)},${f1(cy - a * 0.55)} ${f1(cx + a)},${f1(cy)} S${f1(cx - a * 0.4)},${f1(cy + a * 0.5)} ${f1(cx - a * 0.6)},${f1(cy + a * 0.1)}" fill="none" stroke="${C.pastaLine}" stroke-width="5" stroke-linecap="round"/>`;
    }
    s += `<g clip-path="url(#nest${Math.round(rx)})">${strands}</g>`;
    [[-0.28, -0.55, 0.12], [0.08, -0.72, 0.14], [0.32, -0.42, 0.11], [-0.05, -0.3, 0.1], [0.42, -0.75, 0.08], [-0.42, -0.25, 0.08]].forEach(([px, py, sz], i) => {
      s += `<path d="${blob(px * rx, py * ry, sz * rx, [1, 0.7, 1.15, 0.85, 1.05, 0.8, 0.95], 0.75, i * 0.7)}" fill="${C.tuna}" stroke="${C.tunaLine}" stroke-width="5" stroke-linejoin="round"/>`;
    });
    [[-0.12, -0.95, 15], [0.05, -1.02, -20], [0.2, -0.9, 35], [-0.25, -0.82, -35], [0.12, -0.8, 5]].forEach(([px, py, rot]) => {
      const x = px * rx, y = py * ry;
      s += `<rect x="${f1(x - rx * 0.06)}" y="${f1(y - 4)}" width="${f1(rx * 0.12)}" height="8" rx="3" fill="${C.nori}" transform="rotate(${rot} ${f1(x)} ${f1(y)})"/>`;
    });
    return s;
  }

  function chopsticks(x1, y1, x2, y2) {
    const dx = 0, dy = 18;
    return [0, 1].map((k) => `<line x1="${x1 + dx * k}" y1="${y1 + dy * k}" x2="${x2 + dx * k}" y2="${y2 + dy * k}" stroke="${C.ink}" stroke-width="18" stroke-linecap="round"/>` +
      `<line x1="${x1 + dx * k}" y1="${y1 + dy * k}" x2="${x2 + dx * k}" y2="${y2 + dy * k}" stroke="#C98B4A" stroke-width="8" stroke-linecap="round"/>`).join('');
  }

  function fork(x, y, len, rot) {
    return `<g transform="rotate(${rot} ${x} ${y})">` +
      `<rect x="${x - 11}" y="${y}" width="22" height="${len}" rx="11" fill="${C.steel}" stroke="${C.ink}" stroke-width="${SW}"/>` +
      `<path d="M${x - 30},${y - 70} L${x - 30},${y - 20} Q${x - 30},${y + 4} ${x},${y + 6} Q${x + 30},${y + 4} ${x + 30},${y - 20} L${x + 30},${y - 70}" fill="none" stroke="${C.ink}" stroke-width="${SW + 10}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${x - 30},${y - 70} L${x - 30},${y - 20} Q${x - 30},${y + 4} ${x},${y + 6} Q${x + 30},${y + 4} ${x + 30},${y - 20} L${x + 30},${y - 70}" fill="none" stroke="${C.steel}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="${x - 10}" y1="${y - 66}" x2="${x - 10}" y2="${y - 6}" stroke="${C.ink}" stroke-width="${SW + 8}" stroke-linecap="round"/><line x1="${x - 10}" y1="${y - 66}" x2="${x - 10}" y2="${y - 6}" stroke="${C.steel}" stroke-width="8" stroke-linecap="round"/>` +
      `<line x1="${x + 10}" y1="${y - 66}" x2="${x + 10}" y2="${y - 6}" stroke="${C.ink}" stroke-width="${SW + 8}" stroke-linecap="round"/><line x1="${x + 10}" y1="${y - 66}" x2="${x + 10}" y2="${y - 6}" stroke="${C.steel}" stroke-width="8" stroke-linecap="round"/>` +
      `</g>`;
  }

  // ---------------------------------------------------------------- 道具・材料

  function microwave(x, y, w, h, inside = '') {
    const dw = w * 0.68, px = x + dw + 8, pw = w - dw - 24;
    const wx = x + 20, wy = y + 20, ww = dw - 44, wh = h - 40;
    return `<rect x="${x + 30}" y="${y + h - 4}" width="34" height="16" rx="5" fill="${C.ink}"/><rect x="${x + w - 64}" y="${y + h - 4}" width="34" height="16" rx="5" fill="${C.ink}"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${C.mw}" stroke="${C.ink}" stroke-width="${SW}"/>` +
      `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="14" fill="${C.mwWin}" stroke="${C.ink}" stroke-width="5"/>` +
      `<rect x="${wx + 9}" y="${wy + 9}" width="${ww - 18}" height="${wh - 18}" rx="9" fill="${C.mwGlow}"/>` +
      `<svg x="${wx + 9}" y="${wy + 9}" width="${ww - 18}" height="${wh - 18}" viewBox="0 0 ${ww - 18} ${wh - 18}" overflow="hidden">${typeof inside === 'function' ? inside(ww - 18, wh - 18) : inside}</svg>` +
      `<rect x="${x + dw - 16}" y="${y + 34}" width="14" height="${h - 68}" rx="7" fill="${C.mwPanel}" stroke="${C.ink}" stroke-width="5"/>` +
      `<rect x="${px}" y="${y + 20}" width="${pw}" height="${h - 40}" rx="12" fill="${C.mwPanel}" stroke="${C.ink}" stroke-width="5"/>` +
      `<rect x="${px + 12}" y="${y + 36}" width="${pw - 24}" height="40" rx="6" fill="${C.lcd}"/>` +
      [0, 1, 2].map((k) => `<rect x="${px + 22 + k * ((pw - 44) / 3)}" y="${y + 50}" width="${(pw - 44) / 3 - 8}" height="12" rx="4" fill="${C.lcdOn}"/>`).join('') +
      `<circle cx="${px + pw / 2}" cy="${y + h * 0.56}" r="${Math.min(26, pw * 0.3)}" fill="${C.white}" stroke="${C.ink}" stroke-width="5"/>` +
      `<line x1="${px + pw / 2}" y1="${y + h * 0.56}" x2="${px + pw / 2}" y2="${y + h * 0.56 - Math.min(18, pw * 0.2)}" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="${px + 12}" y="${y + h - 74}" width="${pw - 24}" height="30" rx="9" fill="${C.orange}" stroke="${C.ink}" stroke-width="5"/>`;
  }

  function udonPack(x, y, w, h, label = true) {
    const z = 12, n = Math.max(4, Math.round(w / 26));
    let top = `M${x},${y + z}`, bot = '';
    for (let i = 0; i < n; i++) top += ` L${f1(x + (i + 0.5) * w / n)},${y} L${f1(x + (i + 1) * w / n)},${y + z}`;
    top += ` L${x + w},${y + h - z}`;
    for (let i = n - 1; i >= 0; i--) bot += ` L${f1(x + (i + 0.5) * w / n)},${y + h} L${f1(x + i * w / n)},${y + h - z}`;
    const bx = x + w * 0.16, by = y + h * 0.42, bw = w * 0.68, bh = h * 0.42;
    let s = `<path d="${top}${bot}Z" fill="${C.pack}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>`;
    s += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" rx="12" fill="${C.noodle}" stroke="${C.ink}" stroke-width="4"/>`;
    for (let k = 1; k <= 3; k++) {
      const yy = by + (bh * k) / 4;
      s += `<path d="M${f1(bx + 8)},${f1(yy)} q${f1(bw / 8)},-8 ${f1(bw / 4)},0 t${f1(bw / 4)},0 t${f1(bw / 4)},0" fill="none" stroke="${C.noodleLine}" stroke-width="4" stroke-linecap="round"/>`;
    }
    if (label) s += `<rect x="${f1(x + 10)}" y="${f1(y + h * 0.13)}" width="${f1(w - 20)}" height="${f1(h * 0.22)}" rx="8" fill="${C.packBand}"/>` +
      txt(x + w / 2, y + h * 0.24 + 1, '冷凍うどん', Math.min(26, (w - 30) / 5), C.white, { weight: 900 });
    const sx = x + w * 0.84, sy = y + h * 0.5, sr = Math.min(14, w * 0.08);
    s += [0, 60, 120].map((a) => `<line x1="${sx}" y1="${sy - sr}" x2="${sx}" y2="${sy + sr}" stroke="${C.packBand}" stroke-width="4" stroke-linecap="round" transform="rotate(${a} ${sx} ${sy})"/>`).join('');
    return s;
  }

  function egg(cx, cy, r) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.8}" ry="${r}" fill="#FFF7EA" stroke="${C.ink}" stroke-width="${SW}"/>` +
      `<ellipse cx="${cx - r * 0.25}" cy="${cy - r * 0.4}" rx="${r * 0.14}" ry="${r * 0.22}" fill="#FFFFFF"/>`;
  }

  function bottle(x, y, w, h, label = 'めんつゆ') {
    const body = `M${x + w * 0.33},${y + h * 0.13} C${x + w * 0.33},${y + h * 0.24} ${x},${y + h * 0.24} ${x},${y + h * 0.36} L${x},${y + h - 12} Q${x},${y + h} ${x + 12},${y + h} L${x + w - 12},${y + h} Q${x + w},${y + h} ${x + w},${y + h - 12} L${x + w},${y + h * 0.36} C${x + w},${y + h * 0.24} ${x + w * 0.67},${y + h * 0.24} ${x + w * 0.67},${y + h * 0.13} Z`;
    const lx = x + w * 0.15, ly = y + h * 0.42, lw = w * 0.7, lh = h * 0.48;
    const fs = Math.min(lw * 0.62, (lh - 12) / label.length);
    let s = `<rect x="${x + w * 0.28}" y="${y}" width="${w * 0.44}" height="${h * 0.14}" rx="6" fill="${C.cap}" stroke="${C.ink}" stroke-width="5"/>`;
    s += `<path d="${body}" fill="${C.bottle}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="6" fill="${C.labelPaper}" stroke="${C.ink}" stroke-width="4"/>`;
    [...label].forEach((ch, i) => { s += txt(lx + lw / 2, ly + 6 + fs * (i + 0.5), ch, fs, C.bottle, { weight: 900 }); });
    return s;
  }

  function can(x, y, w, h, label, color) {
    const ry = w * 0.17, fs = Math.min(w * 0.26, (w - 16) / label.length);
    let s = `<path d="M${x},${y} L${x},${y + h} A${w / 2},${ry} 0 0 0 ${x + w},${y + h} L${x + w},${y} Z" fill="${C.can}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    s += `<path d="M${x + 3.5},${y + h * 0.28} L${x + 3.5},${y + h * 0.82} A${w / 2 - 3.5},${ry} 0 0 0 ${x + w - 3.5},${y + h * 0.82} L${x + w - 3.5},${y + h * 0.28} A${w / 2 - 3.5},${ry} 0 0 1 ${x + 3.5},${y + h * 0.28} Z" fill="${color}"/>`;
    s += `<ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="${ry}" fill="${C.canTop}" stroke="${C.ink}" stroke-width="${SW}"/>`;
    s += `<ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2 - 10}" ry="${ry - 5}" fill="none" stroke="${C.steelEdge}" stroke-width="4"/>`;
    s += `<rect x="${x + w / 2 - 14}" y="${y - ry * 0.45}" width="28" height="${ry * 0.9}" rx="${ry * 0.45}" fill="none" stroke="${C.ink}" stroke-width="4"/>`;
    s += txt(x + w / 2, y + h * 0.56 + ry * 0.35, label, fs, C.white, { weight: 900 });
    return s;
  }

  function pastaBox(x, y, w, h) { // パスタ用の電子レンジ容器（水とパスタ）
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="rgba(255,255,255,0.78)" stroke="${C.ink}" stroke-width="5"/>`;
    s += `<rect x="${x + 5}" y="${y + h * 0.38}" width="${w - 10}" height="${h * 0.62 - 5}" rx="9" fill="#BFE3F7"/>`;
    for (let k = 0; k < 5; k++) s += `<line x1="${x + 18}" y1="${y + h * 0.3 + k * h * 0.12}" x2="${x + w - 18}" y2="${y + h * 0.26 + k * h * 0.12}" stroke="${C.pastaLine}" stroke-width="5" stroke-linecap="round"/>`;
    s += `<rect x="${x - 6}" y="${y - 14}" width="${w + 12}" height="20" rx="8" fill="#9ED36A" stroke="${C.ink}" stroke-width="5"/>`;
    for (let k = 1; k <= 6; k++) s += `<circle cx="${x + (w * k) / 7}" cy="${y - 4}" r="3.5" fill="${C.ink}"/>`;
    return s;
  }

  function potSection(x, y, w, h, o = {}) { // 炊飯器の内なべの断面
    const waterY = y + h * (o.water || 0.36), riceY = y + h * (o.rice || 0.6);
    const shape = `M${x},${y} L${x + 14},${y + h - 46} Q${x + 18},${y + h} ${x + 62},${y + h} L${x + w - 62},${y + h} Q${x + w - 18},${y + h} ${x + w - 14},${y + h - 46} L${x + w},${y} Z`;
    const id = 'pot' + Math.round(x) + Math.round(w);
    let s = `<clipPath id="${id}"><path d="${shape}"/></clipPath>`;
    s += `<path d="${shape}" fill="${C.potIn}"/>`;
    let inner = `<rect x="${x}" y="${riceY}" width="${w}" height="${h}" fill="${C.rice}"/>`;
    const rnd = rng(3);
    for (let k = 0; k < 60; k++) {
      const gx = x + 20 + rnd() * (w - 40), gy = riceY + 10 + rnd() * (y + h - riceY - 20);
      inner += `<ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="9" ry="5" transform="rotate(${Math.round(rnd() * 180)} ${f1(gx)} ${f1(gy)})" fill="${C.riceGrain}"/>`;
    }
    if (o.saba) {
      [[0.24, 12], [0.47, -10], [0.7, 18]].forEach(([px, rot], i) => {
        const cx = x + w * px, cy = riceY - 14;
        inner += `<g transform="rotate(${rot} ${f1(cx)} ${f1(cy)})"><path d="${blob(cx, cy, 34, [1, 0.8, 1.1, 0.9, 1.05, 0.75], 0.6, i)}" fill="${C.saba}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>` +
          `<path d="M${f1(cx - 27)},${f1(cy - 11)} Q${f1(cx)},${f1(cy - 22)} ${f1(cx + 27)},${f1(cy - 11)}" fill="none" stroke="${C.sabaSkin}" stroke-width="7" stroke-linecap="round"/></g>`;
      });
    }
    inner += `<rect x="${x}" y="${waterY}" width="${w}" height="${h}" fill="${C.water}"/>`;
    inner += `<path d="M${x},${waterY} q${w / 12},-8 ${w / 6},0 t${w / 6},0 t${w / 6},0 t${w / 6},0 t${w / 6},0 t${w / 6},0" fill="none" stroke="${C.waterLine}" stroke-width="5"/>`;
    s += `<g clip-path="url(#${id})">${inner}</g>`;
    s += `<path d="${shape.replace(/ Z$/, '')}" fill="none" stroke="${C.ink}" stroke-width="${SW + 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    // 目盛り（右の内側）。水面が「2」に合う図（実際の量は炊飯器の目盛りどおり）
    const gx = x + w - 18;
    [[-0.12, '3'], [0, '2'], [0.12, '1']].forEach(([dy, n]) => {
      const yy = waterY + h * dy;
      s += `<line x1="${gx - 30}" y1="${f1(yy)}" x2="${gx}" y2="${f1(yy)}" stroke="${C.ink}" stroke-width="4"/>` + txt(gx - 44, yy, n, 24, C.ink, { weight: 900 });
    });
    return s;
  }

  function cookerButton(x, y) { // 炊飯器の操作パネル（「炊きこみ」を選ぶ）
    return `<rect x="${x}" y="${y}" width="190" height="70" rx="16" fill="#F7F5F0" stroke="${C.ink}" stroke-width="5"/>` +
      `<rect x="${x + 12}" y="${y + 12}" width="110" height="46" rx="8" fill="${C.lcd}"/>` + txt(x + 67, y + 36, '炊きこみ', 24, C.lcdOn, { weight: 900 }) +
      `<circle cx="${x + 156}" cy="${y + 35}" r="20" fill="${C.orange}" stroke="${C.ink}" stroke-width="5"/>`;
  }

  // ---------------------------------------------------------------- カード

  const CARDS = {
    // テーマ：包丁とまな板に「禁止」マーク
    op_noknife() {
      const cx = 470, cy = 245;
      let s = `<g transform="rotate(-10 ${cx} ${cy})">`;
      s += `<rect x="${cx - 250}" y="${cy - 110}" width="500" height="220" rx="34" fill="${C.board}" stroke="${C.ink}" stroke-width="${SW}"/>`;
      [[-70, 0.0], [-20, 0.5], [40, 1.0]].forEach(([dy, k]) => { s += `<path d="M${cx - 220},${cy + dy} q60,${-12 + k * 10} 120,0 t120,0 t120,0" fill="none" stroke="${C.boardGrain}" stroke-width="5" stroke-linecap="round"/>`; });
      s += `<circle cx="${cx + 210}" cy="${cy - 70}" r="14" fill="#FFFFFF" stroke="${C.ink}" stroke-width="5"/>`;
      s += `<rect x="${cx - 215}" y="${cy + 18}" width="120" height="40" rx="14" fill="${C.handle}" stroke="${C.ink}" stroke-width="${SW}"/>`;
      s += `<circle cx="${cx - 180}" cy="${cy + 38}" r="5" fill="${C.steel}"/><circle cx="${cx - 140}" cy="${cy + 38}" r="5" fill="${C.steel}"/>`;
      s += `<path d="M${cx - 95},${cy + 10} L${cx + 150},${cy + 2} Q${cx + 205},${cy + 2} ${cx + 225},${cy + 36} Q${cx + 160},${cy + 66} ${cx - 95},${cy + 66} Z" fill="${C.steel}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      s += `<path d="M${cx - 85},${cy + 56} L${cx + 150},${cy + 56}" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>`;
      s += `</g>`;
      s += `<circle cx="${cx}" cy="${cy}" r="196" fill="rgba(255,255,255,0.18)" stroke="${C.red}" stroke-width="30"/>`;
      s += `<line x1="${cx - 138}" y1="${cy - 138}" x2="${cx + 138}" y2="${cy + 138}" stroke="${C.red}" stroke-width="30"/>`;
      s += sparkle(120, 110, 26) + sparkle(820, 380, 22) + sparkle(800, 100, 16);
      return s;
    },

    // 3品の並び
    lineup() {
      let s = '';
      s += g(udonBowl(110), 160, 245);
      s += g(riceBowl(100), 470, 250);
      s += g(pastaPlate(135), 780, 285);
      [[160, 'レンジで釜玉うどん'], [470, '炊き込みサバ缶ごはん'], [780, 'ツナのレンジパスタ']].forEach(([x, name], i) => {
        s += `<circle cx="${x}" cy="70" r="30" fill="${C.orange}" stroke="${C.ink}" stroke-width="5"/>` + txt(x, 71, String(i + 1), 34, C.white, { weight: 900 });
        s += tag(x, 425, name, { size: 28, pad: 12 });
      });
      return s;
    },

    d1_dish() {
      return chopsticks(640, 120, 900, 300) + steam(470, 120, 80) + g(udonBowl(205), 470, 270) +
        sparkle(150, 140, 24) + sparkle(800, 400, 20);
    },

    d1_how() {
      let s = microwave(30, 60, 400, 250, (w, h) => udonPack(w * 0.24, h * 0.14, w * 0.52, h * 0.78, false));
      s += sfx(372, 66, 'チン！', 50, 10);
      s += g(udonBowl(68), 120, 400);
      s += egg(250, 415, 34);
      s += bottle(330, 330, 76, 140);
      s += steps(468, ['冷凍うどんを\n袋の表示どおりチン', '器に盛る', '卵とめんつゆを\nかける']);
      return s;
    },

    d2_dish() {
      return steam(420, 115, 75) + g(riceBowl(185), 420, 265) + can(700, 250, 140, 170, 'サバ水煮', C.sabaLabel) +
        sparkle(130, 150, 24) + sparkle(860, 120, 20);
    },

    d2_how() {
      let s = potSection(48, 36, 360, 408, { saba: true });
      s += steps(458, ['お米は無洗米\n（研がない）', '缶汁＋めんつゆ→水を\n目盛りまで入れて混ぜる', 'サバは上にのせるだけ\n（[混ぜない]）', '「炊きこみ」で炊く\n（[予約しない]）']);
      return s;
    },

    d3_dish() {
      return steam(470, 105, 70) + g(pastaPlate(300), 450, 300) + fork(840, 250, 190, 18) +
        sparkle(110, 130, 24) + sparkle(820, 90, 18);
    },

    d3_how() {
      let s = microwave(30, 60, 400, 250, (w, h) => pastaBox(w * 0.1, h * 0.36, w * 0.8, h * 0.44));
      s += sfx(372, 66, 'チン！', 50, 10);
      s += g(pastaPlate(92), 120, 420);
      s += can(232, 368, 76, 82, 'ツナ', C.tunaLabel);
      s += bottle(340, 330, 76, 140);
      s += steps(468, ['専用容器に水とパスタ\n（[お湯は使わない]）', '袋の表示どおりチン', '湯を切って\nツナ＋めんつゆで和える']);
      return s;
    },

    // まとめ：表示を見る（加熱時間と水加減）
    ed_check() {
      let s = `<g transform="rotate(-5 230 250)">`;
      s += `<rect x="70" y="60" width="320" height="370" rx="20" fill="#FFF1DC" stroke="${C.ink}" stroke-width="${SW}"/>`;
      s += `<path d="M70,80 Q70,60 90,60 L370,60 Q390,60 390,80 L390,124 L70,124 Z" fill="${C.orange}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      s += txt(230, 93, '調理方法', 34, C.white, { weight: 900 });
      [160, 205, 340, 385].forEach((yy, i) => { s += `<rect x="100" y="${yy}" width="${i % 2 ? 200 : 260}" height="18" rx="9" fill="#E5D3BC"/>`; });
      s += `<rect x="96" y="246" width="268" height="62" rx="12" fill="#FFFFFF" stroke="${C.red}" stroke-width="5"/>`;
      s += txt(230, 278, 'レンジ ○分', 34, C.red, { weight: 900 });
      s += `</g>`;
      s += `<circle cx="300" cy="280" r="92" fill="rgba(255,255,255,0.25)" stroke="${C.ink}" stroke-width="12"/>`;
      s += `<line x1="366" y1="346" x2="430" y2="410" stroke="${C.ink}" stroke-width="30" stroke-linecap="round"/><line x1="370" y1="350" x2="428" y2="408" stroke="${C.handle}" stroke-width="14" stroke-linecap="round"/>`;
      s += potSection(560, 60, 300, 360, { water: 0.48 });
      s += tag(710, 440, '炊飯器の目盛り', { size: 28, pad: 12 });
      return s;
    },

    // まとめ：保存して今夜つくる
    ed_save() {
      let s = '';
      const px = 190, py = 20, pw = 260, ph = 440;
      s += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="40" fill="${C.phone}" stroke="${C.ink}" stroke-width="${SW}"/>`;
      s += `<rect x="${px + 16}" y="${py + 40}" width="${pw - 32}" height="${ph - 70}" rx="16" fill="${C.screen}"/>`;
      s += g(udonBowl(48), px + 92, py + 150) + g(riceBowl(44), px + 92, py + 270) + g(pastaPlate(56), px + 92, py + 370);
      const ix = px + pw - 48;
      s += `<path d="M${ix},${py + 152} c-14,-16 -40,-4 -30,16 c6,12 30,28 30,28 c0,0 24,-16 30,-28 c10,-20 -16,-32 -30,-16z" fill="#FFFFFF" stroke="${C.ink}" stroke-width="5"/>`;
      s += `<path d="M${ix - 26},${py + 226} h52 a10,10 0 0 1 10,10 v24 a10,10 0 0 1 -10,10 h-30 l-14,12 v-12 h-8 a10,10 0 0 1 -10,-10 v-24 a10,10 0 0 1 10,-10z" fill="#FFFFFF" stroke="${C.ink}" stroke-width="5"/>`;
      const by = py + 352;
      s += `<circle cx="${ix}" cy="${by}" r="40" fill="${C.pink}" stroke="${C.ink}" stroke-width="5"/>`;
      s += `<path d="M${ix - 16},${by - 24} h32 v48 l-16,-13 l-16,13 z" fill="#FFFFFF" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>`;
      s += `<path d="M${ix + 48},${by} L${ix + 120},${by}" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>`;
      s += tag(ix + 182, by, '保存', { size: 36, pad: 14, fill: C.pink, color: C.white, weight: 900 });
      // 今夜
      s += `<path d="M770,60 a90,90 0 1 0 90,120 a72,72 0 1 1 -90,-120z" fill="${C.moon}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      s += sparkle(640, 90, 22) + sparkle(880, 250, 18) + sparkle(600, 200, 14);
      s += tag(752, 282, '今夜つくる！', { size: 34, pad: 14 });
      return s;
    },
  };

  window.ILLUST = {
    ids: Object.keys(CARDS),
    svg(id) {
      if (!CARDS[id]) throw new Error('画像 id が見つかりません: ' + id);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>` + CARDS[id]() + `</svg>`;
    },
  };
})();
