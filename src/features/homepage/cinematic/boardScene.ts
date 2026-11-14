import * as THREE from 'three';
import {
  CANDIDATES, KEYFRAMES, LEFT_AXIS, NAMED_COUNT, NOW_SQUARE, RESULTS, SQUARES, TOP_AXIS,
  boardMode, clamp, easeOut, goldSquares, hexToRgb, initials, lerp, seededRandom, smooth, windowed,
} from './cinematicModel';

/**
 * The cinematic board: 100 glass tiles, 20 number tiles and a tray, drawn with three.js.
 * Imperative and self-contained: the React layer only feeds it scroll progress and pointer state.
 * Gold is used only for matching and result squares.
 */

export interface SceneFrame { s: number; phone: boolean; pointerX: number; pointerY: number; hover: number; pick: number }
export interface Backdrop { top: [number, number, number]; bottom: [number, number, number]; beam: number; bands: number }
export interface BoardScene {
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: SceneFrame): Backdrop;
  hit(clientX: number, clientY: number): number;
  redrawText(): void;
  dispose(): void;
}

const PI = Math.PI;
const S = 0.9, H = 0.24, OFF = 0.55;

const roundedRect = (w: number, h: number, r: number) => {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
};

type AtlasKind = 'light' | 'dark' | 'cand' | 'gold';
const PALETTE: Record<AtlasKind, [string, string, string, string]> = {
  light: ['#FFFFFF', '#13212E', '#5B6670', 'rgba(19,33,46,.16)'],
  dark: ['#22364A', '#F6F7F5', '#B4BEC6', 'rgba(246,247,245,.16)'],
  cand: ['#22364A', '#F6F7F5', '#F6F7F5', '#F6F7F5'],
  gold: ['#E3A91C', '#13212E', '#13212E', '#E3A91C'],
};

export function createBoardScene(canvas: HTMLCanvasElement, { coarse }: { coarse: boolean }): BoardScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 400);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T) => { disposables.push(item); return item; };

  // Studio reflections drawn in code: soft panels and a few long light strips.
  {
    const pmrem = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), new THREE.MeshBasicMaterial({ color: 0x0b131b, side: THREE.BackSide })));
    const panel = (w: number, h: number, x: number, y: number, z: number, k: number) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.06), side: THREE.DoubleSide }));
      mesh.position.set(x, y, z); mesh.lookAt(0, 0, 0); env.add(mesh); return mesh;
    };
    panel(22, 8, 0, 20, 2, 5); panel(8, 14, -20, 8, 6, 2.6); panel(8, 14, 20, 7, -8, 2.2); panel(28, 5, 0, 4, -24, 1.4);
    for (let k = -3; k <= 3; k++) { const strip = panel(1.1, 34, k * 5.5, 17, -6 + k * 2, 3.6); (strip.material as THREE.MeshBasicMaterial).color.setRGB(3.2, 3.6, 4.4); strip.rotateZ(0.5); }
    scene.environment = keep(pmrem.fromScene(env, 0.03).texture);
    pmrem.dispose();
  }

  // r155+ lights are physical; multiply by PI to keep the tuned look.
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x0a121a, 0.55 * PI); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.7 * PI); key.position.set(-7, 16, 9); key.castShadow = true;
  key.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  key.shadow.bias = -0.0008; key.shadow.radius = 4;
  scene.add(key);
  const flood = new THREE.DirectionalLight(0xc4deff, 0); flood.position.set(8, 14, -10); scene.add(flood);

  const board = new THREE.Group(); scene.add(board);

  /* ---- Textures ---- */
  const CELL = coarse ? 128 : 192;
  const texture = (source: HTMLCanvasElement) => {
    const tex = keep(new THREE.CanvasTexture(source));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  };
  const atlases = new Map<AtlasKind, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; tags: Record<number, string> }>();
  const drawCell = (g: CanvasRenderingContext2D, kind: AtlasKind, i: number, tag?: string) => {
    const x = (i % 10) * CELL, y = Math.floor(i / 10) * CELL, name = SQUARES[i], u = CELL / 160, p = PALETTE[kind];
    g.fillStyle = p[0]; g.fillRect(x, y, CELL, CELL);
    if (!name) {
      g.save(); g.beginPath(); g.rect(x, y, CELL, CELL); g.clip();
      g.strokeStyle = kind === 'light' ? 'rgba(19,33,46,.13)' : 'rgba(246,247,245,.1)'; g.lineWidth = 3 * u;
      for (let k = -CELL; k < CELL * 2; k += 14 * u) { g.beginPath(); g.moveTo(x + k, y + CELL); g.lineTo(x + k + CELL, y); g.stroke(); }
      g.restore();
    }
    g.strokeStyle = p[3]; g.lineWidth = (kind === 'cand' ? 9 : 3) * u;
    const m = g.lineWidth / 2; g.strokeRect(x + m, y + m, CELL - 2 * m, CELL - 2 * m);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (name) { g.fillStyle = p[1]; g.font = `800 ${58 * u}px Inter, Archivo, Arial, sans-serif`; g.fillText(initials(name), x + CELL / 2, y + CELL * (tag ? 0.56 : 0.5)); }
    if (name && !tag) { g.fillStyle = p[2]; g.font = `500 ${17 * u}px Inter, Archivo, Arial, sans-serif`; g.fillText(name.length > 11 ? `${name.slice(0, 10)}…` : name, x + CELL / 2, y + CELL * 0.84); }
    if (tag) {
      g.fillStyle = p[1]; g.font = `700 ${24 * u}px "Geist Mono", monospace`; g.fillText(tag, x + CELL / 2, y + CELL * 0.2);
      if (name) { g.font = `500 ${16 * u}px Inter, Archivo, Arial, sans-serif`; g.fillText(name, x + CELL / 2, y + CELL * 0.87); }
    }
  };
  const drawAtlas = (kind: AtlasKind) => {
    const atlas = atlases.get(kind)!, g = atlas.canvas.getContext('2d')!;
    for (let i = 0; i < 100; i++) {
      const candidate = CANDIDATES.get(i);
      drawCell(g, kind, i, kind === 'cand' && candidate ? `+${candidate[0].points}` : atlas.tags[i]);
    }
    atlas.tex.needsUpdate = true;
  };
  for (const kind of ['light', 'dark', 'cand', 'gold'] as const) {
    const source = document.createElement('canvas'); source.width = source.height = CELL * 10;
    atlases.set(kind, { canvas: source, tex: texture(source), tags: {} });
    drawAtlas(kind);
  }
  let goldTags = '';
  const setGoldTags = (final: boolean) => {
    const mode = final ? 'final' : 'live';
    if (mode === goldTags) return;
    goldTags = mode;
    atlases.get('gold')!.tags = final ? { [RESULTS.Q1]: 'Q1', [RESULTS.Q2]: 'Q2', [RESULTS.Q3]: 'Q3', [RESULTS.Final]: 'FINAL' } : { [NOW_SQUARE]: 'NOW' };
    drawAtlas('gold');
  };
  setGoldTags(false);

  const AX = 128;
  const axisCanvas = document.createElement('canvas'); axisCanvas.width = AX * 10; axisCanvas.height = AX * 2;
  const axisTex = texture(axisCanvas);
  const blankCanvas = document.createElement('canvas'); blankCanvas.width = blankCanvas.height = AX;
  const blankTex = texture(blankCanvas);
  const drawAxis = () => {
    const g = axisCanvas.getContext('2d')!; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let row = 0; row < 2; row++) for (let k = 0; k < 10; k++) {
      g.fillStyle = '#24384C'; g.fillRect(k * AX, row * AX, AX, AX);
      g.fillStyle = '#F6F7F5'; g.font = `600 ${AX * 0.56}px "Geist Mono", monospace`;
      g.fillText(String((row ? LEFT_AXIS : TOP_AXIS)[k]), k * AX + AX / 2, row * AX + AX * 0.54);
    }
    axisTex.needsUpdate = true;
    const q = blankCanvas.getContext('2d')!;
    q.fillStyle = '#E4E9ED'; q.fillRect(0, 0, AX, AX); q.fillStyle = '#44515C'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.font = `600 ${AX * 0.5}px "Geist Mono", monospace`; q.fillText('?', AX / 2, AX * 0.54);
    blankTex.needsUpdate = true;
  };
  drawAxis();

  /* ---- Materials ---- */
  const physical = (options: THREE.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18, ...options }));
  const dark = atlases.get('dark')!.tex;
  const M = {
    side: physical({ color: 0x2c4660, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }),
    blank: physical({ color: 0xf1f3f3, roughness: 0.55 }),
    light: physical({ map: atlases.get('light')!.tex, color: 0xf2f4f4, roughness: 0.5 }),
    dark: physical({ map: dark, roughness: 0.3, clearcoat: 0.35 }),
    cand: physical({ map: atlases.get('cand')!.tex, roughness: 0.34, emissive: 0xffffff, emissiveMap: atlases.get('cand')!.tex, emissiveIntensity: 0.22 }),
    lane: physical({ map: dark, roughness: 0.34, emissive: 0xffffff, emissiveMap: dark, emissiveIntensity: 0.6 }),
    gold: keep(new THREE.MeshBasicMaterial({ map: atlases.get('gold')!.tex, toneMapped: false })),
    axisTop: physical({ map: blankTex, roughness: 0.5 }),
    axisBottom: physical({ map: axisTex, roughness: 0.34 }),
    slab: physical({ color: 0x070d14, roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.12 }),
    rim: keep(new THREE.MeshBasicMaterial({ color: 0xa9cdf5, toneMapped: false, transparent: true, opacity: 0.8 })),
  };
  M.slab.envMapIntensity = 0.22;
  const envMaterials = [M.side, M.blank, M.light, M.dark, M.cand, M.axisTop, M.axisBottom, M.lane];

  /* ---- Geometry ---- */
  const slab = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundedRect(12.3, 12.3, 0.7), { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 12 })), M.slab);
  slab.rotation.x = -PI / 2; slab.position.y = -H / 2 - 0.42; slab.receiveShadow = true; board.add(slab);
  const rim = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundedRect(12.47, 12.47, 0.78), { depth: 0.035, bevelEnabled: false, curveSegments: 12 })), M.rim);
  rim.rotation.x = -PI / 2; rim.position.y = -H / 2 - 0.16; board.add(rim);
  const groundMaterial = keep(new THREE.ShadowMaterial({ opacity: 0.28 }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(80, 80)), groundMaterial);
  ground.rotation.x = -PI / 2; ground.position.y = -H / 2 - 0.5; ground.receiveShadow = true; scene.add(ground);

  const BEV = 0.05, CAP = S - 2 * BEV;
  const baseGeo = keep(new THREE.ExtrudeGeometry(roundedRect(CAP, CAP, 0.1), { depth: H - 2 * BEV, bevelEnabled: true, bevelSize: BEV, bevelThickness: BEV, bevelSegments: 3, curveSegments: 5 }));
  baseGeo.rotateX(-PI / 2); baseGeo.translate(0, -(H - 2 * BEV) / 2, 0);
  const capGroup = baseGeo.groups[0], sideGroup = baseGeo.groups[1], half = capGroup.count / 2;
  const topFirst = baseGeo.attributes.position.getY(capGroup.start) > 0;
  baseGeo.clearGroups();
  baseGeo.addGroup(capGroup.start + (topFirst ? 0 : half), half, 0);   // top face
  baseGeo.addGroup(sideGroup.start, sideGroup.count, 1);                 // rounded glass edge
  baseGeo.addGroup(capGroup.start + (topFirst ? half : 0), half, 2);   // bottom face
  const tileGeometry = (columns: number, rows: number, column: number, row: number, fullTop = false) => {
    const geometry = keep(baseGeo.clone()), pos = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let v = capGroup.start; v < capGroup.start + capGroup.count; v++) {
      const top = pos.getY(v) > 0, fx = pos.getX(v) / CAP + 0.5, z = pos.getZ(v) / CAP, ft = top ? z + 0.5 : -z + 0.5;
      if (top && fullTop) uv.setXY(v, fx, 1 - ft); else uv.setXY(v, (column + fx) / columns, 1 - (row + ft) / rows);
    }
    return geometry;
  };

  type TileData = { i: number; home: THREE.Vector3; dir: THREE.Vector3; spin: number; wave: number; order: number; hover: number; top: THREE.Material; bottom: THREE.Material };
  const rnd = seededRandom(11);
  const tiles: THREE.Mesh[] = [];
  for (let i = 0; i < 100; i++) {
    const row = Math.floor(i / 10), column = i % 10;
    const mesh = new THREE.Mesh(tileGeometry(10, 10, column, row), [M.blank, M.side, M.dark]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const home = new THREE.Vector3(column - 4.5 + OFF, 0, row - 4.5 + OFF); mesh.position.copy(home);
    const angle = rnd() * PI * 2;
    mesh.userData = { i, home, dir: new THREE.Vector3(Math.cos(angle) * (2 + rnd() * 4), 2.5 + rnd() * 6, Math.sin(angle) * (2 + rnd() * 4)), spin: (rnd() - 0.5) * 5, wave: (row + column) / 18, order: rnd(), hover: 0, top: M.blank, bottom: M.dark } satisfies TileData;
    board.add(mesh); tiles.push(mesh);
  }
  type AxisData = { home: THREE.Vector3; isTop: boolean; j: number; dir: THREE.Vector3 };
  const axes: THREE.Mesh[] = [];
  for (let k = 0; k < 20; k++) {
    const isTop = k < 10, j = k % 10;
    const mesh = new THREE.Mesh(tileGeometry(10, 2, j, isTop ? 0 : 1, true), [M.axisTop, M.side, M.axisBottom]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const home = isTop ? new THREE.Vector3(j - 4.5 + OFF, 0, -5.1 + OFF * 0.2) : new THREE.Vector3(-5.1 + OFF * 0.2, 0, j - 4.5 + OFF);
    mesh.position.copy(home);
    mesh.userData = { home, isTop, j, dir: new THREE.Vector3((rnd() - 0.5) * 6, 3 + rnd() * 5, (rnd() - 0.5) * 6) } satisfies AxisData;
    board.add(mesh); axes.push(mesh);
  }

  // Phones for the share chapter: every phone shows the same board.
  const phones = new THREE.Group(); scene.add(phones);
  {
    const source = document.createElement('canvas'); source.width = 256; source.height = 512;
    const g = source.getContext('2d')!;
    g.fillStyle = '#F6F7F5'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#13212E'; g.font = '800 20px Inter, Archivo, Arial'; g.fillText('Sunday Football', 20, 50);
    g.fillStyle = '#5B6670'; g.font = '500 13px Arial'; g.fillText(`${NAMED_COUNT} named · ${100 - NAMED_COUNT} open`, 20, 74);
    for (let i = 0; i < 100; i++) { g.fillStyle = SQUARES[i] ? '#13212E' : '#D9DDD8'; g.fillRect(20 + (i % 10) * 21.8, 96 + Math.floor(i / 10) * 21.8, 19, 19); }
    g.fillStyle = '#13212E'; g.beginPath(); g.roundRect(20, 350, 216, 44, 22); g.fill();
    g.fillStyle = '#F6F7F5'; g.font = '600 15px Arial'; g.textAlign = 'center'; g.fillText('Find my squares', 128, 378);
    const screen = keep(new THREE.MeshBasicMaterial({ map: texture(source), toneMapped: false }));
    const body = physical({ color: 0x0c151e, roughness: 0.3, metalness: 0.4 });
    const bodyGeo = keep(new THREE.ExtrudeGeometry(roundedRect(2.3, 4.7, 0.34), { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 10 }));
    const screenGeo = keep(new THREE.PlaneGeometry(2.04, 4.36));
    const count = 7;
    for (let k = 0; k < count; k++) {
      const phone = new THREE.Group(), shell = new THREE.Mesh(bodyGeo, body), face = new THREE.Mesh(screenGeo, screen);
      shell.castShadow = true; face.position.z = 0.21; phone.add(shell, face);
      const a = (k - (count - 1) / 2) * 0.34;
      phone.userData = { x: Math.sin(a) * 10.2, z: -9.5 + (1 - Math.cos(a)) * 6, ry: a * 0.7, d: Math.abs(k - (count - 1) / 2) / 3 };
      phones.add(phone);
    }
  }

  const rgb = KEYFRAMES.map(k => k.bg.map(hexToRgb) as [[number, number, number], [number, number, number]]);
  let width = 1, height = 1;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const results = new Set([RESULTS.Q1, RESULTS.Q2, RESULTS.Q3, RESULTS.Final]);

  return {
    resize(w, h, pixelRatio) {
      width = w; height = h;
      renderer.setPixelRatio(Math.min(pixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    },
    render({ s, phone, pointerX, pointerY, hover, pick }) {
      const i0 = Math.min(KEYFRAMES.length - 2, Math.floor(s)), f = s - i0, A = KEYFRAMES[i0], B = KEYFRAMES[i0 + 1], t = smooth(clamp(f));
      // Camera: orbit the board, then shift the frame so the board sits where the layout leaves room.
      const fa = phone ? A.phone : A.desktop, fb = phone ? B.phone : B.desktop, frame = fa.map((v, j) => lerp(v, fb[j], t));
      const az = lerp(A.az, B.az, t) * PI / 180, el = lerp(A.el, B.el, t) * PI / 180;
      const tanV = Math.tan(camera.fov * PI / 360), tanH = tanV * camera.aspect, span = 13.2;
      const r = Math.max(span / (2 * tanH * frame[2]), span / (2 * tanV * frame[3]) * Math.max(0.5, Math.sin(el)));
      camera.position.set(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(width, height, -(frame[0] - 0.5) * width, -(frame[1] - 0.5) * height, width, height);
      camera.updateProjectionMatrix();

      // The hero keeps its dark backdrop until its copy has scrolled away.
      const tb = i0 === 0 ? smooth(clamp((f - 0.6) / 0.4)) : t;
      const top = rgb[i0][0].map((v, j) => Math.round(lerp(v, rgb[i0 + 1][0][j], tb))) as [number, number, number];
      const bottom = rgb[i0][1].map((v, j) => Math.round(lerp(v, rgb[i0 + 1][1][j], tb))) as [number, number, number];
      hemi.intensity = lerp(A.hemi, B.hemi, t) * PI; key.intensity = lerp(A.key, B.key, t) * PI; flood.intensity = lerp(A.flood, B.flood, t) * PI;
      const env = lerp(A.env, B.env, t); envMaterials.forEach(m => { m.envMapIntensity = env; });
      M.rim.opacity = lerp(A.rim, B.rim, t); rim.visible = M.rim.opacity > 0.01;
      groundMaterial.opacity = lerp(0.16, 0.3, clamp(top[0] / 200));

      // Tiles
      const scatter = clamp((s - 0.2) / 0.7), bell = Math.sin(PI * scatter), mode = boardMode(s);
      setGoldTags(mode === 'final');
      const gold = new Set(goldSquares(mode));
      const liveW = (1 - smooth(clamp(s / 0.35))) + windowed(s, 3.95, 5.6), sweatW = windowed(s, 4.55, 5.5), laneW = windowed(s, 3.95, 4.55), finalW = windowed(s, 5.6, 6.4);
      const nowRow = Math.floor(NOW_SQUARE / 10), nowColumn = NOW_SQUARE % 10;
      for (const mesh of tiles) {
        const u = mesh.userData as TileData, i = u.i, row = Math.floor(i / 10), column = i % 10;
        const flip = s < 1 ? PI * (1 - easeOut(scatter)) : PI * smooth(clamp((s - 3.3) * 3.4 - u.wave * 1.25));
        mesh.rotation.set(flip, 0, bell * u.spin);
        let y = 0;
        const fillAt = 0.9 + u.order * 0.34;
        if (s >= 1 && s < 3) y += 0.22 * windowed(s, fillAt - 0.03, fillAt + 0.03, 0.035);
        if (i === NOW_SQUARE) y += 0.5 * liveW;
        if (row === nowRow || column === nowColumn) y += 0.13 * laneW;
        if (CANDIDATES.has(i)) y += 0.34 * sweatW;
        if (results.has(i)) y += ({ [RESULTS.Q1]: 0.3, [RESULTS.Q2]: 0.45, [RESULTS.Q3]: 0.6, [RESULTS.Final]: 0.8 } as Record<number, number>)[i] * finalW;
        u.hover += (((i === hover || i === pick) && s < 0.2 ? 0.32 : 0) - u.hover) * 0.25; y += u.hover;
        mesh.position.set(u.home.x + u.dir.x * bell, y + u.dir.y * bell, u.home.z + u.dir.z * bell);
        const topMaterial = s >= fillAt && s >= 1 ? M.light : M.blank;
        let bottomMaterial: THREE.Material = M.dark;
        if (gold.has(i)) bottomMaterial = M.gold;
        else if (mode === 'sweat' && CANDIDATES.has(i)) bottomMaterial = M.cand;
        else if (mode === 'live' && s > 3.9 && (row === nowRow || column === nowColumn)) bottomMaterial = M.lane;
        const materials = mesh.material as THREE.Material[];
        if (u.top !== topMaterial) { materials[0] = topMaterial; u.top = topMaterial; }
        if (u.bottom !== bottomMaterial) { materials[2] = bottomMaterial; u.bottom = bottomMaterial; }
      }
      axes.forEach((mesh, k) => {
        const u = mesh.userData as AxisData;
        const spin = s < 1 ? PI * (1 - easeOut(scatter)) : PI * 5 * easeOut(clamp((s - 2.5) * 2.6 - k * 0.045));
        mesh.rotation.set(spin, 0, 0);
        const lift = (u.isTop ? u.j === nowColumn : u.j === nowRow) ? 0.3 * (laneW + sweatW * 0.5) : 0;
        mesh.position.set(u.home.x + u.dir.x * bell, lift + u.dir.y * bell, u.home.z + u.dir.z * bell);
      });
      const phoneW = windowed(s, 1.4, 2.45, 0.35);
      phones.visible = phoneW > 0.002;
      phones.children.forEach(p => {
        const u = p.userData as { x: number; z: number; ry: number; d: number }, w = smooth(clamp(phoneW * 1.6 - u.d * 0.5));
        p.position.set(u.x, lerp(0.5, 3.1, w), u.z); p.rotation.set(-0.12, u.ry, 0); p.scale.setScalar(Math.max(0.001, 1.25 * w));
      });
      board.rotation.x = pointerY * 0.035; board.rotation.z = -pointerX * 0.035;
      renderer.render(scene, camera);
      return { top, bottom, beam: lerp(A.beam, B.beam, tb), bands: lerp(A.bands, B.bands, tb) };
    },
    hit(clientX, clientY) {
      ndc.set(clientX / width * 2 - 1, -(clientY / height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(tiles, false)[0];
      return hit ? (hit.object.userData as TileData).i : -1;
    },
    redrawText() { (['light', 'dark', 'cand', 'gold'] as const).forEach(drawAtlas); drawAxis(); },
    dispose() {
      disposables.forEach(item => item.dispose());
      renderer.dispose();
    },
  };
}
