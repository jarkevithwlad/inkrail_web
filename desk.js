import {defaults} from './defaults.js';

// All desk coordinates are CSS pixels (96dpi logical units).
const asset = name => new URL('./assets/' + name, import.meta.url).href;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const number = (n, fallback) => Number.isFinite(n) ? n : fallback;
const mix = (a, b, t) => a + (b - a) * t;
function smooth(low, high, x) {
  let t = clamp((x - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}
export function deskGeometry(width, height, settings = {}) {
  width = Math.max(1, number(width, 1)); height = Math.max(1, number(height, 1));
  const paperWidth = Math.min(settings.focusMode && settings.widerFocusPaper !== false ? 960 : 720, Math.max(1, width - (width <= 600 ? 24 : 104)));
  const gutter = (width - paperWidth) / 2;
  const paperHeight = Math.max(230, height - (height <= 440 ? 74 : 112));
  const scale = clamp((gutter - 44) / 160, .1, 1.52);
  const left = Math.max(12, gutter - 26 - 160 * scale);
  const top = Math.max(70, Math.min(height - 270 * scale - 48, height * .61 - 225.5433 * scale));
  const showAccent = !settings.focusMode && gutter >= 156 && height >= 400;
  const linen = settings.deskAccent === 'linenLamps';
  const lamps = showAccent && (linen || settings.deskAccent === 'brassLamps');
  const bottom = (settings.paperStartPosition ?? defaults.paperStartPosition) === 'bottom';
  return {width, height, paperWidth, paperHeight, gutter, bottom,
    editorHeight: paperHeight - (bottom ? 172 : 148), showAccent, linen, lamps, scale, left, top,
    sourceX: left + (linen ? 60.0325 : 112.5853) * scale,
    sourceY: top + (linen ? 100.1217 : 67.0969) * scale,
    footX: left + 46.8735 * scale, footY: top + 225.5433 * scale};
}
export function lightRGB(warmth) {
  warmth = clamp(number(warmth, defaults.lampWarmth), 0, 1);
  const cool = [.92, .96, 1], middle = [1, .86, .65], amber = [1, .64, .30];
  return warmth <= .5 ? cool.map((v, i) => mix(v, middle[i], warmth * 2))
    : middle.map((v, i) => mix(v, amber[i], (warmth - .5) * 2));
}
export function desktopLight(x, y, linen = false) {
  const rise = Math.max(0, y), width = (linen ? 55 : 32) + rise * (linen ? .72 : .53);
  const cross = (x - 8 - rise * (linen ? .32 : .22)) / width;
  return Math.exp(-1.9 * cross * cross) / (1 + (rise / 158) ** 2)
    * smooth(-12, 20, y) * (1 - smooth(235, 370, y));
}
export function capsuleLight(x, rise) {
  const d = Math.abs(x), up = Math.max(0, rise);
  if (d >= 360 || rise >= 416 || rise <= -24) return 0;
  const main = Math.exp(-1.2 * (d / (22 + up * 1.35)) ** 2.6 - (up / 135) ** 1.5);
  const bounce = .10 * Math.exp(-((x / 160) ** 2) - ((rise - 70) / 170) ** 2);
  return (1 - (1 - main) * (1 - bounce)) * Math.exp(-((Math.max(0, -rise) / 7) ** 2))
    * (1 - smooth(312, 360, d)) * (1 - smooth(368, 416, rise)) * (1 - smooth(12, 24, -rise));
}
export function paperEdgeLight(g, x, y) {
  if (!g.lamps || x < 0 || x >= 42) return 0;
  const atEdge = desktopLight((g.gutter - g.sourceX) / g.scale, ((g.paperTop ?? 58) + y - g.sourceY) / g.scale, g.linen);
  return Math.min(1, atEdge * 2.25) * Math.exp(-x / 13) * (1 - smooth(27, 42, x));
}
export function paperOutline(width, height, feed, curved = true) {
  if (!curved) return {outline: `M3 0 H${width-3} Q${width} 0 ${width} 3 V${height-3} Q${width} ${height} ${width-3} ${height} H3 Q0 ${height} 0 ${height-3} V3 Q0 0 3 0 Z`, lip: ''};
  const depth = clamp(width * .13, 56, 104), inset = clamp(width * .09, 22, 64);
  const t = -clamp(number(feed, 0), 0, depth);
  const lip = `M0 ${t+depth} C0 ${t+depth*.48} ${inset*.42} ${t+4} ${inset} ${t+4} C${width*.34} ${t-1} ${width*.66} ${t-1} ${width-inset} ${t+4} C${width-inset*.42} ${t+4} ${width} ${t+depth*.48} ${width} ${t+depth}`;
  return {lip, outline: `${lip} V${height} H0 Z`};
}
export function carriagePosition(g, c = {}) {
  const x = clamp(number(c.x, 78), Math.min(64, g.paperWidth / 2), Math.max(g.paperWidth / 2, g.paperWidth - 64));
  const writingY = Math.min(g.paperHeight - 108, Math.max(150, number(c.caretBottom, 104) + 42));
  const y = g.bottom ? g.editorHeight + 38
    : Math.max(writingY, Number.isFinite(c.followingTextBottom) ? Math.min(c.followingTextBottom, g.editorHeight) + 56 : 0);
  // Leave the full hammer above the rail clear of a visible wax impression.
  return {x, y:Number.isFinite(c.sealBottom) ? Math.max(y, c.sealBottom + 56) : y};
}
const materials = {
  classic: [['#e5e2d6','#d2cfc4','#b5b2a8'],'#68705d',22,'steel'],
  brushedSteel: [['#e2e7e6','#b5bfbe','#899594','#c6cecc','#677270'],'#4d5b58',9,'steel'],
  champagne: [['#f4e3b8','#cdb580','#ad8f54','#d9c394','#8a6d3c'],'#725834',16,'brass'],
  walnut: [['#927052','#6f4d33','#503320','#6f4b32','#382416'],'#ceb57b',11,'brass'],
  porcelain: [['#fffef7','#f1ede0','#e5dfd0','#f8f4e9','#c6c0af'],'#7d8d78',23,'charcoal'],
  midnight: [['#4a504f','#303635','#222826','#323837','#151b19'],'#cbb67c',8,'charcoal'],
  roseQuartz: [['#fae7e6','#e7bdbf','#d19b9f','#f0cbcc','#a66f79'],'#a07063',22,'brass'],
  seaGlass: [['#cce9dd','#83b8a8','#538e82','#a8d0bd','#34675f'],'#c6dbd3',20,'steel'],
  lavender: [['#eee5f5','#c7b4d9','#a18ab9','#d4c2e5','#7c6994'],'#ece7eb',18,'steel'],
  racingGreen: [['#5b7968','#274e3c','#18372a','#3b614d','#11281e'],'#c7ac70',10,'brass'],
  copper: [['#f0c7a4','#c68a60','#9d5e3c','#d59a73','#6f412d'],'#416f64',13,'charcoal'],
  wildflower: [['#fff7df','#e9dfc1','#d4c7a5','#f4eacf','#b4a685'],'#657d61',21,'brass']
};
const papers = {ivory:'#eeecd9',cream:'#e5d7b7',white:'#f3f1e9'};
const finishes = {porcelain:'#e5e2d6',sage:'#86977c',cobalt:'#3d609c',terracotta:'#ad6548',graphite:'#454c4a'};
const canvas = (w, h) => Object.assign(document.createElement('canvas'), {width:w, height:h});
const tint = rgb => `rgb(${rgb.map(x => Math.round(x * 255)).join(' ')})`;
const masks = new Map();
function mask(w, h, pixel) {
  const image = canvas(w, h);
  const ctx = image.getContext('2d');
  const pixels = ctx.createImageData(w, h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = 255;
    pixels.data[i+3] = Math.round(pixel(x+.5, y+.5) * 255);
  }
  ctx.putImageData(pixels, 0, 0);
  return image;
}
function cachedMask(name, w, h, fn) {
  if (!masks.has(name)) masks.set(name, mask(w, h, fn));
  return masks.get(name);
}
function coloredMask(bitmap, color) {
  const image = canvas(bitmap.width, bitmap.height), ctx = image.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color;
  ctx.fillRect(0, 0, image.width, image.height);
  return image;
}
function drawPair(ctx, bitmap, x, y, w, h, fullWidth) {
  ctx.drawImage(bitmap, x, y, w, h);
  ctx.save(); ctx.translate(fullWidth, 0); ctx.scale(-1, 1); ctx.drawImage(bitmap, x, y, w, h); ctx.restore();
}
function setupCanvas(layer, w, h) {
  // Cap just the layer's internal resolution at 2x; physical size and
  // caret coordinates never depend on scale. Keeps high-DPI memory bounded.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.ceil(w * dpr), height = Math.ceil(h * dpr);
  if (layer.width !== width) layer.width = width;
  if (layer.height !== height) layer.height = height;
  const ctx = layer.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w + 1, h + 1);
  return ctx;
}
function sample(index,salt) {
  let n = (Math.imul(index,747796405)+Math.imul(salt,2891336453))|0;
  n = Math.imul(n^(n>>>16),2246822519);
  return ((n^(n>>>13)) & 0xffffff)/0x1000000;
}
function noise(x, y, salt) {
  const col = Math.floor(x), row = Math.floor(y), key = col + row * 4099;
  const u = smooth(0, 1, x - col), v = smooth(0, 1, y - row);
  return mix(mix(sample(key,salt),sample(key+1,salt),u),mix(sample(key+4099,salt),sample(key+4100,salt),u),v);
}
function grainFlow(x,y) {
  return (noise(x/390,y/155,11)-.5)*24 + (noise(x/150,y/65,29)-.5)*5 + (noise(x/45,y/24,47)-.5)*.8;
}
function paintMaterial(layer, w, h, material) {
  const ctx = setupCanvas(layer,w,h);
  if (material==='walnut' || material==='oak') {
    const oak = material==='oak', pale = oak?'#baab8d':'#9a8670', dark = oak?'#40362a':'#1e1a16';
    for (let index=0;index<h/2.1+24;index++) {
      const y=index*2.1-24+sample(index,3)*1.25;
      ctx.beginPath(); let joined=false;
      for (let x=0;x<=w+8;x+=8) {
        const visible=noise(x/86,y/3.7,71)>.28, p=y+grainFlow(x,y);
        if (visible && joined) ctx.lineTo(x,p); else ctx.moveTo(x,p);
        joined=visible;
      }
      ctx.strokeStyle=sample(index,19)>.68?pale:dark;
      ctx.globalAlpha=.025+sample(index,43)*(oak?.085:.065);
      ctx.lineWidth=.35+sample(index,83)*.65; ctx.stroke();
    }
    ctx.strokeStyle=dark; ctx.lineCap='round';
    for(let row=-1;row<h/16+1;row++) for(let col=0;col<w/26;col++) {
      const i=col+row*4099,x=col*26+sample(i,107)*26,y=row*16+sample(i,131)*16;
      const len=1.5+sample(i,151)**3*(oak?19:11);
      ctx.globalAlpha=.025+sample(i,173)*.075; ctx.lineWidth=.4+sample(i,191)*.6;
      ctx.beginPath(); ctx.moveTo(x,y+grainFlow(x,y)); ctx.lineTo(x+len,y+grainFlow(x+len,y));ctx.stroke();
    }
  } else if (material==='felt') {
    ctx.strokeStyle='#a1b09a';ctx.globalAlpha=.065;ctx.lineWidth=.7;
    ctx.beginPath();
    for(let row=0;row<=h+12;row+=12) for(let col=0;col<=w+15;col+=15) {
      const p=(row*31+col*17)%97,x=col+Math.sin(p)*3,y=row+Math.cos(p*.7)*3;
      ctx.moveTo(x,y);ctx.lineTo(x+2.5+Math.sin(p*.4),y+Math.cos(p)*2);
    }
    ctx.stroke();
  } else if (material==='linen') {
    ctx.fillStyle='#beb69e';ctx.globalAlpha=.045;for(let x=0;x<w;x+=5) ctx.fillRect(x,0,.7,h);
    ctx.fillStyle='black';ctx.globalAlpha=.075;for(let y=0;y<h;y+=5) ctx.fillRect(0,y,w,.8);
  } else if (material==='leather') {
    const tile=leatherTile();
    const pattern=ctx.createPattern(tile,'repeat');
    pattern.setTransform(new DOMMatrix().scale(.5));
    ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);
  }
  ctx.globalAlpha=1;
}
// Height-field leather from the same warped cellular crease profile as the
// Mac desk. Hashes are precomputed once per lattice; no noise work while typing.
function leatherTile() {
  if(masks.has('leather'))return masks.get('leather');
  const side=512, heights=new Float32Array(side*side), fields=new Map();
  const lattice=(period,salt)=>{
    const key=period+':'+salt;
    if(!fields.has(key)){
      const cells=new Float32Array(period*period);
      for(let y=0;y<period;y++)for(let x=0;x<period;x++)cells[y*period+x]=sample(x+y*4099,salt);
      fields.set(key,cells);
    }
    const values=fields.get(key), wrap=period-1;
    return (x,y)=>values[(y&wrap)*period+(x&wrap)];
  };
  const field=(period,salt)=>{
    const random=lattice(period,salt);
    return (x,y)=>{
      const col=Math.floor(x),row=Math.floor(y),u=smooth(0,1,x-col),v=smooth(0,1,y-row);
      return mix(mix(random(col,row),random(col+1,row),u),mix(random(col,row+1),random(col+1,row+1),u),v);
    };
  };
  const valley=(period,salt)=>{
    const jitterX=lattice(period,salt),jitterY=lattice(period,salt+37);
    return (x,y)=>{
      const col=Math.floor(x),row=Math.floor(y);let first=Infinity,second=Infinity;
      for(let j=row-1;j<=row+1;j++)for(let i=col-1;i<=col+1;i++){
        const dx=i+.04+jitterX(i,j)*.92-x,dy=j+.04+jitterY(i,j)*.92-y,d=dx*dx+dy*dy;
        if(d<first){second=first;first=d;}else if(d<second)second=d;
      }
      return Math.sqrt(second)-Math.sqrt(first);
    };
  };
  const warpX=field(16,13),warpXF=field(32,23),warpY=field(16,41),warpYF=field(32,53);
  const fine=valley(64,71),folds=valley(16,113),pores=field(256,149),cloud=field(8,181);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const wx=(warpX(x/32,y/32)-.5)*10+(warpXF(x/16,y/16)-.5)*2.5;
    const wy=(warpY(x/32,y/32)-.5)*10+(warpYF(x/16,y/16)-.5)*2.5;
    const pebble=(1-Math.exp(-fine((x+wx)/8,(y+wy)/8)*3.4))*.66;
    const fold=Math.exp(-folds((x+wy*2)/32,(y+wx*2)/32)*24)*.09;
    heights[y*side+x]=pebble-fold+pores(x/2,y/2)*.028;
  }
  const get=(x,y)=>heights[(y&(side-1))*side+(x&(side-1))];
  const image=canvas(side,side),ctx=image.getContext('2d'),pixels=ctx.createImageData(side,side);
  for(let y=0,i=0;y<side;y++)for(let x=0;x<side;x++,i+=4){
    const nx=(get(x-1,y)-get(x+1,y))*1.5,ny=(get(x,y-1)-get(x,y+1))*1.5;
    const slope=(nx*-.56+ny*-.73+.39)/Math.sqrt(1+nx*nx+ny*ny)-.39;
    const shade=clamp(.505+slope*.57+Math.min(0,get(x,y)-.19)*.21+(cloud(x/64,y/64)-.5)*.025,.25,.76);
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=Math.round(shade*255);pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);masks.set('leather',image);return image;
}
function textureTile(kind) {
  if (masks.has(kind)) return masks.get(kind);
  const size=256, image=canvas(size*2,size*2),ctx=image.getContext('2d');
  ctx.scale(2,2);ctx.lineCap='round';
  if (kind==='laid') {
    for(let row=0;row<80;row++) {
      const y=row*3.2+1;
      ctx.beginPath();ctx.moveTo(0,y);
      for(let i=1;i<=32;i++)ctx.lineTo(i*8,y+Math.sin(i*Math.PI/8)*.17);
      ctx.strokeStyle=`rgba(102,89,61,${row%5===0?.18:.11})`;ctx.lineWidth=.42;ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.19)';ctx.fillRect(0,y+.6,size,.35);
    }
    ctx.fillStyle='rgba(122,110,77,.06)';
    for(let col=0;col<8;col++)ctx.fillRect(col*32+9,0,.55,size);
  }
  for(let i=0;i<(kind==='laid'?180:510);i++) {
    const x=sample(i,17)*size,y=sample(i,83)*size,r=sample(i,149);
    const alpha=kind==='laid'?.10:.12+r*.25, radius=.17+r*.35;
    ctx.fillStyle=`rgba(94,79,51,${alpha})`;
    ctx.beginPath();ctx.ellipse(x,y,radius,radius*.65,0,0,Math.PI*2);ctx.fill();
    if(i%4===0){
      const len=1.8+sample(i,257)*4.5,a=sample(i,311)*Math.PI;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+len*.25,y-len*.20,x+Math.cos(a)*len,y+Math.sin(a)*len);
      ctx.strokeStyle=`rgba(115,102,69,${alpha*.55})`;ctx.lineWidth=.27;ctx.stroke();
    }
  }
  masks.set(kind,image);return image;
}

function gardenArt(w, h) {
  const parts = [];
  for (const s of [1,-1]) {
    const edge = s === 1 ? 13 : w-13;
    let stem = `M${edge} 32`;
    for (let i=1;i<=28;i++) stem += `L${edge+Math.sin(i*.8)*7} ${i*h/28}`;
    parts.push(`<path d="${stem}" stroke="#65724b" stroke-opacity=".65" stroke-width="1.1" fill="none"/>`);
    for (let i=1;i<=25;i++) {
      const y = i*(h-30)/26+13, x = edge+Math.sin(i*.8)*7;
      const length=12+i%4*2, d=i%2===0?s:-s*.55;
      parts.push(`<path d="M${x} ${y} Q${x+d*(length+7)} ${y-1} ${x+d*length} ${y-17} Q${x+d*2} ${y-19} ${x} ${y}" fill="${i%2===0?'#71824f':'#436043'}"/>`);
      if (i%6===2) {
        const cx=x+s*15;
        for(let j=0;j<5;j++) {
          const a = j*Math.PI*2/5;
          parts.push(`<ellipse cx="${cx+Math.cos(a)*4}" cy="${y+Math.sin(a)*4}" rx="3" ry="3.5" fill="${s===1?'#a99bb2':'#dfd9bd'}"/>`);
        }
        parts.push(`<circle cx="${cx}" cy="${y}" r="1.5" fill="#b8a064"/>`);
      }
    }
  }
  return parts.join('');
}

const marginMotifs = {
  artDeco: {
    height: 96,
    art: `<g stroke="#91754a" fill="none" stroke-width=".95" stroke-opacity=".76">
      <path d="M18 0V22 M18 74V96 M18 22L14 26V31L9 36V60L14 65V70L18 74L22 70V65L27 60V36L22 31V26Z"/>
      <path d="M18 36L13 48L18 60L23 48Z" stroke-width=".75"/>
      <path d="M18 45L16 48L18 51L20 48Z" fill="#91754a" stroke="none"/>
    </g>`,
  },
  celestial: {
    height: 112,
    art: `<path d="M12 18L24 36L16 54L23 67" stroke="#586879" stroke-opacity=".52" stroke-width=".75" fill="none"/>
    <g fill="#586879" fill-opacity=".8">
      <circle cx="12" cy="18" r="1.6"/><circle cx="16" cy="54" r="1.35"/><circle cx="23" cy="67" r="1.75"/>
      <circle cx="11" cy="87" r=".9"/><circle cx="24" cy="98" r=".8"/>
    </g>
    <path d="M24 31L25 35L28 36L25 37L24 41L23 37L20 36L23 35Z" fill="#91754a"/>`,
  },
};

function marginArt(style, width, height) {
  if (style === 'botanical') return gardenArt(width, height);
  let edge;
  if (style === 'ledger') {
    edge = `<g stroke="#8c514d">
      <path d="M16 0V${height}" stroke-width=".95" opacity=".64"/>
      <path d="M20 0V${height}" stroke-width=".6" opacity=".36"/>
    </g>`;
  } else if (Object.hasOwn(marginMotifs, style)) {
    const motif = marginMotifs[style], tiles = [];
    for (let y = 0; y < height; y += motif.height)
      tiles.push(`<g transform="translate(0 ${y})">${motif.art}</g>`);
    edge = tiles.join('');
  } else {
    return '';
  }
  return edge + `<g transform="translate(${width} 0) scale(-1 1)">${edge}</g>`;
}

function embossPath(style) {
  // These same contours press the paper and catch the lamp along the lower rim.
  if (style === 'monogram') return 'M30 14h40a16 16 0 0 1 16 16v40a16 16 0 0 1-16 16H30a16 16 0 0 1-16-16V30a16 16 0 0 1 16-16Z M29 32H44 M36.5 32V67 M29 67H44 M53 68V32H62 C78 32 78 51 62 51H53 M61 51L72 68';
  if (style === 'botanical') return 'M12 50a38 42 0 1 0 76 0a38 42 0 1 0-76 0Z M49 78C56 63 43 45 49 31 M51 65Q41 54 32 48 M49 57Q58 51 68 40 M48 69Q36 73 28 61Q40 59 48 69 M52 66Q62 56 70 57Q66 66 52 66 M47 51Q39 51 36 35Q45 39 47 51 M49 23Q56 22 54 29Q57 36 49 34Q41 36 44 29Q42 23 49 23 M30 42Q35 40 34 46Q34 51 30 50Q24 51 27 46Q25 42 30 42 M69 34Q75 33 73 38Q76 44 69 43Q63 44 65 39Q62 34 69 34';
  if (style === 'sunburst') {
    let rays = '';
    for(let i=0;i<32;i++){
      const a=i*Math.PI/16,r1=i%2===0?16:21,r2=i%2===0?37:31;
      rays += `M${48+Math.cos(a)*r1} ${48+Math.sin(a)*r1}L${48+Math.cos(a)*r2} ${48+Math.sin(a)*r2} `;
    }
    return 'M5 48a43 43 0 1 0 86 0a43 43 0 1 0-86 0Z M38 48a10 10 0 1 0 20 0a10 10 0 1 0-20 0Z ' + rays;
  }
  return '';
}
function setEmboss(node, style) {
  if (style === 'makerMark') {
    node.innerHTML = `<rect class="ink-desk__seal-shadow" width="96" height="96"/>
      <rect class="ink-desk__seal-highlight" width="96" height="96"/>
      <rect class="ink-desk__seal-face" width="96" height="96"/>`;
    return;
  }
  const path = embossPath(style);
  node.innerHTML = [
    ['translate(-.7 -.9)','#4b4434','.9','1.9'],
    ['translate(.72 1)','#fffced','.95','1.2'],
    ['','#645a44','.38','1.1']
  ].map(([tr,stroke,opacity,width]) => `<path d="${path}" transform="${tr}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}
function embossRim(style, makerImage) {
  const key='emboss-rim-'+style;
  if (masks.has(key)) return masks.get(key);
  if (style==='makerMark' && !makerImage.naturalWidth) return null;
  const tile=canvas(192,192),ctx=tile.getContext('2d');
  ctx.scale(2,2);
  if (style==='makerMark') {
    // The bevel catches the most light. The flat letterface catches half as much.
    ctx.drawImage(makerImage,15+.72,20.5+1,66,55);
    ctx.globalCompositeOperation='destination-out';
    ctx.globalAlpha=.5;
    ctx.drawImage(makerImage,15,20.5,66,55);
  } else {
    ctx.translate(.72,1);
    ctx.lineWidth=1.2;
    ctx.lineJoin=ctx.lineCap='round';
    ctx.stroke(new Path2D(embossPath(style)));
  }
  masks.set(key,tile);
  return tile;
}
function deskAccentArt(kind){
  if(kind==='paperclip'){
    const wire='M8 18V-27C8-38 -8-38 -8-27V30C-8 46 16 46 16 30V-28C16-50 -16-50 -16-28V20';
    return `<g fill="none" stroke-linecap="round"><path d="${wire}" stroke="#48473e" stroke-width="2.6"/><path d="${wire}" stroke="#a49e8d" stroke-width="1.65"/><path d="${wire}" transform="translate(-.35 -.35)" stroke="#ded8c7" stroke-opacity=".5" stroke-width=".45"/></g>`;
  }
  if(kind==='envelope')return '<rect x="-47" y="-33" width="94" height="66" rx=".8" fill="#9a927f"/><path d="M-47 33L-4-1Q0-4 4-1L47 33Z" fill="#aaa18d" stroke="#8d8573" stroke-width=".55"/><path d="M-47-33L-5 6Q0 10 5 6L47-33Z" fill="#b5ad99" stroke="#928a77" stroke-width=".65"/><path d="M-46.5 32V-32.5H46.5" fill="none" stroke="#d7cfb8" stroke-opacity=".22" stroke-width=".45"/>';
  if(kind!=='sprig')return '';
  const leaves=[[4,-67,-12,-91,7],[0,-51,27,-76,11],[-1,-32,-29,-56,12],[1,-14,31,-37,10],[5,5,-27,-13,13],[8,27,34,2,12],[6,47,-24,31,11],[2,63,25,47,8]];
  return '<path d="M-12 84C20 26 -14 -23 8 -83" fill="none" stroke="#787764" stroke-width="1.2" stroke-linecap="round"/>'+leaves.map(([x,y,tx,ty,w],i)=>{
    const mx=(x+tx)/2,my=(y+ty)/2,d=tx<x?-1:1;
    const leaf=`M${x} ${y}C${mx+d*w} ${y+2} ${tx+d*3} ${ty+9} ${tx} ${ty}C${mx-d*w*.5} ${ty-5} ${x-d*3} ${y-8} ${x} ${y}`;
    return `<path d="${leaf}" fill="${i%3===0?'#81806a':'#697461'}"/><path d="M${x} ${y}Q${mx+d*2} ${my+2} ${tx} ${ty}" fill="none" stroke="#b4ad8c" stroke-opacity=".27" stroke-width=".45"/>`;
  }).join('');
}

function capsuleArt(style, trim, lit) {
  if (style === 'classic') {
    return `<g class="ink-desk__engraving">
      <rect x="73" y="17.67" width="14" height="11.67" fill="white" fill-opacity=".34"/>
      <rect x="73" y="17.17" width="14" height="11.67" fill="var(--engraving-color)"/>
    </g>`;
  }
  const textures={brushedSteel:'brushed',champagne:'brushed',walnut:'wood',porcelain:'ceramic',
    midnight:'matte',roseQuartz:'mineral',seaGlass:'frosted',lavender:'enamel',racingGreen:'enamel',
    copper:'hammered',wildflower:'ceramic'};
  const radius=materials[style][2];
  const out=[];
  const path=(d,fill='none',stroke='none',width=1,opacity=1)=>out.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const box=(x,y,w,h,r,fill,stroke='none',width=1,opacity=1)=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`);
  const dot=(x,y,r,fill,opacity=1)=>out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`);
  const oval=(x,y,rx,ry,fill,opacity=1)=>out.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}"/>`);
  const diamond=(x,y,w,h,fill=trim,stroke='none')=>path(`M${x} ${y-h/2}L${x+w/2} ${y} ${x} ${y+h/2} ${x-w/2} ${y}Z`,fill,stroke,.7);
  const text=(value,x,y,fill,size,spacing)=>out.push(`<text x="${x}" y="${y}" fill="${fill}" text-anchor="middle" font-family="Courier New, monospace" font-size="${size}" letter-spacing="${spacing}">${value}</text>`);
  const ribs=(x)=>{for(let i=0;i<3;i++){box(x+i*2.8,14,.8,18,.4,trim,'none',1,.5);box(x+i*2.8+1,14,.65,18,.4,'white','none',1,.45);}};
  const screw=(x,color)=>{dot(x,23,2.25,color);path(`M${x-1.35} 23.63l2.7 -1.26`,'none','#3a3028',.6,.6);};
  const texture=textures[style];
  if(texture==='brushed'){
    for(let i=0;i<30;i++)path(`M0 ${i*46/30+.3}H110`,'none',i%3===0?'white':'black',.35,i%3===0?.16:.07);
  }else if(texture==='wood'){
    for(let i=0;i<13;i++){
      let d='';
      for(let x=0;x<=32;x++)d+=`${x===0?'M':'L'}${x*110/32} ${i*46/12+Math.sin(x*.22+i*.72)*1.8}`;
      path(d,'none',i%3===0?'white':'black',i%2===0?.55:.3,i%3===0?.10:.23);
    }
  }else if(texture==='ceramic'||texture==='matte'||texture==='frosted'){
    const frosted=texture==='frosted';
    for(let i=0;i<(frosted?150:95);i++){
      const x=frosted?(i*37+11)%113/113*110:(i*47+13)%109/109*110;
      const y=frosted?(i*19+5)%47/47*46:(i*23+7)%43/43*46;
      dot(x,y,frosted?(i%4===0?.6:.25):.35,texture==='ceramic'?'black':'white',frosted?.14:texture==='ceramic'?.075:.045);
    }
  }else if(texture==='mineral'){
    for(let i=0;i<7;i++){const x=i*23-18;path(`M${x} -3C${x+32} 13.8 ${x+4} 31.28 ${x+37} 49`,'none','white',i%2===0?1.4:.7,i%2===0?.25:.12);}
  }else if(texture==='hammered'){
    for(let i=0;i<54;i++){
      const x=(i*31+7)%107,y=(i*17+3)%43,r=1.2+i%3*.3;
      oval(x,y,r,r*.65,'black',.055);out.push(`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.65}" fill="none" stroke="white" stroke-width=".4" opacity=".13"/>`);
    }
  }else if(texture==='enamel'){
    path('M6 0H30L65 46H48Z','white','none',1,.10);
  }
  box(.5,.5,109,45,radius,'none',style==='porcelain'?'#524938':'#241e19',.8,style==='porcelain'?.18:.45);
  box(1.15,1.15,107.7,43.7,Math.max(2,radius-1),'none','white',.6,.18);
  if(style==='brushedSteel'){
    ribs(9);ribs(94);box(40,18,30,10,5,'#4a5550','#c4cbc4',.6);dot(48,23,1.5,lit?'#c8d5a2':'#91a681');box(55.5,22.6,9,.8,.4,'#bfc7be');
  }else if(style==='champagne'){
    box(4,4,102,38,12,'none',trim,.6,.45);
    for(const x of [15,78])for(let i=0;i<3;i++)box(x,18+i*3.7,17,.7,0,trim,'none',1,.65);
    box(42.5,16,25,14,3,'#4c5145','#f8e9c5',.7);diamond(55,23,6,7,'none','#eddcad');
  }else if(style==='walnut'){
    box(33,14,44,18,3,trim,'#372818',.6);text('INKRAIL',55,25,'#59462b',5.5,1.1);screw(11,trim);screw(99,trim);
  }else if(style==='porcelain'){
    box(39.5,19.5,31,11,5.5,trim,'#66755f',.6);dot(49,25,1.5,'#ecebdd');box(54.5,24.65,9,.7,.35,'#e5e3d0');box(27,8,56,2,1,'white','none',1,.45);
  }else if(style==='midnight'){
    box(4,4,102,38,5,'none',trim,.55,.4);box(26.5,32.7,57,.6,0,trim,'none',1,.8);dot(49.5,21,1.5,trim);text('IR',58,23,trim,6,1.7);
  }else if(style==='roseQuartz'){
    box(4,4,102,38,19,'none',trim,.6,.38);box(40,15.5,30,15,7.5,'#f6e8db',trim,.65,.92);
    diamond(55,23,5,7);dot(47,23,1,trim,.65);dot(63,23,1,trim,.65);path('M17 13L53 9','none','white',1.5,.65);
  }else if(style==='seaGlass'){
    box(4,4,102,38,19,'none',trim,1,.48);box(6,6,98,34,17,'none','#2f655e',.55,.30);
    path('M42.5 22C51 17 59 27 67.5 22 M42.5 26.4C51 21.4 59 31.4 67.5 26.4','none','#f0f7e9',.9,.90);
    oval(31,11,18,2,'white',.27);
  }else if(style==='lavender'){
    for(const x of [14,76])for(let i=0;i<3;i++)box(x+(i===1?0:2.5),19+i*3.3,i===1?20:15,.8,.4,trim,'none',1,.65);
    box(40.5,17,29,12,6,'#655476',trim,.7,.9);dot(49,23,1,trim,.7);diamond(55,23,4,5);dot(61,23,1,trim,.7);
    box(32,8.25,46,1.5,.75,'white','none',1,.60);
  }else if(style==='racingGreen'){
    box(17,1,5,44,0,'#eae3c9');box(25,1,2,44,0,'#eae3c9','none',1,.85);
    box(49,15,28,16,5,'#142f23',trim,.85);text('IR',63,25.5,'#ebe3c6',7,1.2);ribs(94);
  }else if(style==='copper'){
    box(3.5,3.5,103,39,9,'none',trim,1.1,.78);box(36,14.5,38,17,4,'#36534b','#edc39b',.7);
    text('INKRAIL',55,25,'#f1ceac',5,.65);screw(11,'#ddb088');screw(99,'#ddb088');
  }else if(style==='wildflower'){
    const bloom=[[14,16,3,'#b97670'],[27,32,2.6,'#bc9752'],[36,12,2.7,'#8d7b9d'],
      [76,30,3,'#b97670'],[87,12,2.6,'#bc9752'],[98,26,2.6,'#8d7b9d']];
    for(const [x,y,r,color] of bloom){
      path(`M${x-3} ${Math.min(42,y+12)}Q${x+3} ${y+6} ${x} ${y}`,'none','#607856',.6,.85);
      oval(x-2.5,y+6,2.5,1,'#798a5e');
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(x+Math.cos(a)*r,y+Math.sin(a)*r,1.7,2,color);}
      dot(x,y,1,'#eee1ae');
    }
    box(42.5,17,25,12,6,'#536b50','#f7edcd',.7,.9);diamond(55,23,4,5,'#e7d8a9');
    box(3.5,3.5,103,39,19.5,'none','#8d976c',.6,.38);
  }
  box(42,.25,26,4,2,'black','none',1,.5);
  return out.join('');
}

function drawPaperGrain(grain,g,prefs,classicImage,feed) {
  const mode=prefs.paperTexture ?? 'classic', strength=clamp(number(prefs.textureStrength,defaults.textureStrength),0,1);
  const rolling=prefs.paperMotion==='roll';
  const ctx=setupCanvas(grain,g.paperWidth,g.paperHeight);
  if(mode==='smooth'||!strength)return;
  const tiles=[];
  if((mode==='classic'||mode==='cotton')&&classicImage.complete&&classicImage.naturalWidth)
    tiles.push([classicImage,640,mode==='cotton'?strength*.22:.35*strength/.55]);
  if(mode==='laid'||mode==='cotton') tiles.push([textureTile(mode),256,strength]);
  for(const [tile,period,alpha] of tiles){
    ctx.globalAlpha=alpha;
    const phase=feed%period, bend=Math.max(1,Math.min(180,g.editorHeight*.72));
    const pattern=ctx.createPattern(tile,'repeat');
    const from=(y)=>y>=bend?y:2*Math.sqrt(bend*y)-bend;
    function band(top, bottom, docStart, docEnd, sx){
      const sy=(bottom-top)/Math.max(.001,docEnd-docStart);
      ctx.save();
      ctx.beginPath();ctx.rect(0,top,g.paperWidth,bottom-top+.13);ctx.clip();
      ctx.translate(g.paperWidth*(1-sx)/2,top-(docStart+phase)*sy);
      ctx.scale(sx*period/tile.width,sy*period/tile.height);
      ctx.fillStyle=pattern;
      const ratio=tile.height/period;
      ctx.fillRect(-period,(docStart+phase-1)*ratio,(g.paperWidth/sx+period)*tile.width/period,(docEnd-docStart+2)*ratio);
      ctx.restore();
    }
    if(rolling){
      for(let y=0;y<bend;y+=2){
        const end=Math.min(bend,y+2),a=from(y),b=from(end);
        band(y,end,a,b,.88+.12*clamp(((a+b)/2+bend)/(2*bend),0,1));
      }
      band(bend,g.paperHeight,bend,g.paperHeight,1);
    } else band(0,g.paperHeight,0,g.paperHeight,1);
  }
  ctx.globalAlpha=1;
}

const railMarkup = '<i></i><span class="ink-desk__margin-stops"></span><i></i>';
const capsuleMarkup = '<span class="ink-desk__hammer"></span><span class="ink-desk__housing"><i></i><i></i><i></i><svg class="ink-desk__capsule-art" viewBox="0 0 110 46" aria-hidden="true"></svg></span><span class="ink-desk__emitter"></span>';
export function mountDesk(root, callbacks = {}) {
  const shell = document.createElement('div');
  shell.className = 'ink-desk__shell';
  const capsuleHTML=callbacks.preview
    ? `<span class="ink-desk__capsule" aria-hidden="true">${capsuleMarkup}</span>`
    : `<button class="ink-desk__capsule" type="button" aria-label="Переключить подсветку каретки" title="Переключить подсветку каретки · Ctrl+Alt+L">${capsuleMarkup}</button>`;
  shell.innerHTML = `
    <div class="ink-desk__table" aria-hidden="true">
      <canvas class="ink-desk__material"></canvas><canvas class="ink-desk__pools"></canvas>
      <div class="ink-desk__lamp ink-desk__lamp--left"><img alt="" draggable="false"><i></i></div>
      <div class="ink-desk__lamp ink-desk__lamp--right"><img alt="" draggable="false"><i></i></div>
      <div class="ink-desk__foot ink-desk__foot--left"></div><div class="ink-desk__foot ink-desk__foot--right"></div>
      <svg class="ink-desk__accent" viewBox="-63 -103 126 206"></svg>
    </div>
    <header class="ink-desk__header"></header>
    <div class="ink-desk__paper">
      <div class="ink-desk__sheet">
        <div class="ink-desk__substrate" aria-hidden="true">
          <canvas class="ink-desk__grain"></canvas><div class="ink-desk__curl"></div>
          <svg class="ink-desk__lip"><path></path></svg>
          <svg class="ink-desk__emboss" viewBox="0 0 96 96"></svg>
          <canvas class="ink-desk__edge-light"></canvas><canvas class="ink-desk__lamp-tint"></canvas>
        </div>
        <svg class="ink-desk__margin-art" aria-hidden="true"></svg>
        <div class="ink-desk__surface"></div>
        <canvas class="ink-desk__veil" aria-hidden="true"></canvas>
        <div class="ink-desk__rail" aria-hidden="true">${railMarkup}</div>
        ${capsuleHTML}
      </div>
      <div class="ink-desk__controls"></div>
    </div>
    <footer class="ink-desk__footer"></footer>`;
  root.append(shell);
  const q = name => shell.querySelector('.ink-desk__'+name);
  const header=q('header'), controls=q('controls'), footer=q('footer'), surface=q('surface');
  const rail=q('rail'), capsule=q('capsule'), capsuleDetails=q('capsule-art'), lip=q('lip').firstElementChild;
  const margin=q('margin-art'), emboss=q('emboss');
  const table=q('table'), accent=q('accent'), lamps=Array.from(shell.querySelectorAll('.ink-desk__lamp'));
  const feet=Array.from(shell.querySelectorAll('.ink-desk__foot'));
  const grain=q('grain'), material=q('material'), pools=q('pools'), edge=q('edge-light'), beam=q('lamp-tint'), veil=q('veil');
  const classicImage = new Image();
  const makerImage = new Image();
  makerImage.onload=()=>{lastPosition=undefined;schedule();};
  let prefs={}, caret={}, g, frame=0, lastFeed, lastLayout, lastTexture, lastEmboss, lastAccent, lastLamp, lastMargin, lastPosition, strikeTimer;
  let edgeMask, capsuleTint, appearance, lastArt, relief=0;
  let destroyed=false;
  const css = (node, vars) => { for (const [key,value] of Object.entries(vars)) node.style.setProperty(key, String(value)); };
  const show = (node, visible) => {node.hidden = !visible;};
  function layout() {
    const bounds=root.getBoundingClientRect();
    g=deskGeometry(callbacks.width ?? bounds.width, callbacks.height ?? bounds.height,prefs);
    if (callbacks.paperHeight) {
      g.paperHeight=callbacks.paperHeight;
      g.editorHeight=callbacks.preview ? g.paperHeight : Math.max(1,g.paperHeight-(g.bottom?172:148));
    }
    if (callbacks.fullWidth) g.paperWidth=g.width;
    if (callbacks.preview) g.paperTop=callbacks.noCapsule&&!callbacks.fullWidth?26:0;
    css(shell,{'--paper-width':g.paperWidth+'px','--paper-height':g.paperHeight+'px','--editor-height':g.editorHeight+'px',
      '--scene-width':g.width+'px','--scene-height':g.height+'px','--curl-shade-height':clamp(g.paperWidth*.13,56,104)*1.65+'px'});
    const finish=prefs.focusMode?'charcoal':prefs.deskFinish ?? 'charcoal';
    const materialKey=`${g.width}:${g.height}:${finish}`;
    if(lastLayout!==materialKey){ lastLayout=materialKey; paintMaterial(material,g.width,g.height,finish); }
    shell.dataset.finish=finish;
    shell.dataset.night=!!prefs.nightMode;
    shell.dataset.focus=!!prefs.focusMode;
    shell.dataset.curved=prefs.curvedPaper!==false;
    shell.dataset.roll=prefs.paperMotion==='roll';
    shell.dataset.paired=g.lamps;
    show(pools,g.lamps);show(edge,g.lamps);
    let sceneKind=g.linen?'linen':'brass';
    const visibleAccent=g.showAccent && !g.lamps ? prefs.deskAccent ?? 'none' : 'none';
    show(accent,visibleAccent!=='none');
    if(lastAccent!==visibleAccent){
      lastAccent=visibleAccent; accent.innerHTML=deskAccentArt(visibleAccent); accent.dataset.kind=visibleAccent;
    }
    css(accent,{'left':(visibleAccent==='paperclip'?g.width-Math.min((g.gutter-22)/2,128):Math.min((g.gutter-22)/2,128))+'px',
      'top':(g.height*({paperclip:.34,envelope:.73,sprig:.66}[visibleAccent]??1))+'px'});
    for(const [i,lamp] of lamps.entries()){
      show(lamp,g.lamps); show(feet[i],g.lamps);
      if(g.lamps){
        const src=asset(`desk-lamp-${sceneKind}-body.png`);
        if(lamp.firstElementChild.src!==src)lamp.firstElementChild.src=src;
        lamp.lastElementChild.style.setProperty('mask-image',`url("${asset(`desk-lamp-${sceneKind}-emitter.png`)}")`);
        css(lamp,{'left':(i===0?g.left:g.width-g.left-160*g.scale)+'px','top':g.top+'px',
          'width':160*g.scale+'px','height':270*g.scale+'px'});
        css(feet[i],{'left':(i===0?g.footX:g.width-g.footX)+'px','top':g.footY+'px','--foot-scale':g.scale});
      }
    }
    const marginKey=`${prefs.marginStyle}:${g.paperWidth}:${g.paperHeight}`;
    if (lastMargin!==marginKey) {
      lastMargin=marginKey;
      margin.innerHTML=marginArt(prefs.marginStyle,g.paperWidth,g.paperHeight);
    }
  }
  function customize() {
    shell.toggleAttribute('data-narrow-margins', prefs.wideMargins === false);
    const type=Object.hasOwn(materials,prefs.mechanismStyle)?prefs.mechanismStyle:defaults.mechanismStyle;
    const [colors,trim,radius,preferred]=materials[type];
    const lamp=lightRGB(prefs.lampWarmth);
    appearance={color:tint(lamp),intensity:clamp(number(prefs.lampIntensity,defaults.lampIntensity),.25,1)};
    css(shell,{
      '--paper-color':papers[prefs.paper] ?? papers.ivory,
      '--capsule-fill':finishes[prefs.capsule] ?? finishes.porcelain,
      '--engraving-color':['cobalt','graphite'].includes(prefs.capsule) ? 'rgb(232 225 202 / .58)' : 'rgb(36 41 33 / .5)',
      '--capsule-material':`linear-gradient(${colors.join(',')})`,
      '--trim':trim,'--capsule-radius':radius+'px','--lamp-color':appearance.color,
      '--lamp-alpha':.55+appearance.intensity*.45,
      '--lamp-glow':.2+appearance.intensity*.40
    });
    rail.dataset.finish=type==='classic'||prefs.matchRailToStyle===false ? prefs.rail ?? 'steel' : preferred;
    rail.dataset.style=type; capsule.dataset.style=type;
    const artKey=type+':'+!!prefs.nightMode;
    if(lastArt!==artKey){lastArt=artKey;capsuleDetails.innerHTML=capsuleArt(type,trim,!!prefs.nightMode);}
    if(!callbacks.preview)capsule.setAttribute('aria-pressed',String(!!prefs.nightMode));
    if(lastEmboss!==prefs.paperEmbossing){lastEmboss=prefs.paperEmbossing;setEmboss(emboss,lastEmboss);}
    relief=Math.pow(clamp(number(prefs.embossingDepth,defaults.embossingDepth),0,1),.72);
    emboss.style.opacity=relief;
    if (lastEmboss==='makerMark' && prefs.nightMode && !makerImage.src) makerImage.src=asset('maker-mark.png');
    lastPosition=undefined;
  }
  function paintLamps() {
    const key=`${g.width}:${g.height}:${g.paperWidth}:${g.paperHeight}:${g.lamps}:${g.linen}:${appearance.color}:${appearance.intensity}:${!!prefs.nightMode}`;
    if(lastLamp===key) return;
    lastLamp=key;
    if (g.lamps) {
      const poolMask=cachedMask(g.linen?'poolLinen':'poolBrass',640,440,(x,y)=>desktopLight(x-250,y-40,g.linen));
      const p=setupCanvas(pools,g.width,g.height);p.globalAlpha=.82*appearance.intensity;
      drawPair(p,coloredMask(poolMask,appearance.color),g.sourceX-250*g.scale,g.sourceY-40*g.scale,640*g.scale,440*g.scale,g.width);
      edgeMask=mask(42,Math.ceil(g.paperHeight),(x,y)=>paperEdgeLight(g,x,y));
      const e=setupCanvas(edge,g.paperWidth,g.paperHeight);e.globalAlpha=.9*appearance.intensity;
      drawPair(e,coloredMask(edgeMask,appearance.color),0,0,42,g.paperHeight,g.paperWidth);
    } else edgeMask=undefined;
    if(prefs.nightMode && !callbacks.noCapsule && !callbacks.noVeil) {
      const profile=cachedMask('capsule',720,440,(x,y)=>capsuleLight(x-360,416-y));
      if(capsuleTint?.color!==appearance.color) capsuleTint={color:appearance.color,bitmap:coloredMask(profile,appearance.color)};
    }
    lastPosition=undefined;
  }
  function paintGrain(feed) {
    const key=[g.paperWidth,g.paperHeight,prefs.paperTexture,prefs.textureStrength,prefs.paperMotion,feed,classicImage.naturalWidth].join(':');
    if(lastTexture===key)return;
    lastTexture=key;
    drawPaperGrain(grain,g,prefs,classicImage,feed);
  }
  async function printPaper() {
    const settings={...prefs,paperMotion:'sheet'}, width=g.paperWidth;
    const height=Math.max(g.paperHeight, Math.ceil(width*11/8.5));
    const substrate=q('substrate').cloneNode(false);
    substrate.style.setProperty('--paper-color',papers[settings.paper] ?? papers.ivory);
    const texture=grain.cloneNode(false);
    const ornaments=document.createElement('div');
    ornaments.className='ink-print-ornaments';
    if (margin.hasChildNodes()) {
      const border=margin.cloneNode(false);
      border.style.removeProperty('transform');
      border.innerHTML=marginArt(settings.marginStyle,width,height);
      ornaments.append(border);
    }
    if (settings.paperEmbossing && settings.paperEmbossing!=='none') {
      const mark=emboss.cloneNode(true);
      mark.hidden=false;
      css(mark,{'left':Math.max(60,width-77)+'px','top':'77px','transform':'translate(-50%,-50%)'});
      ornaments.append(mark);
    }
    if (['classic','cotton'].includes(settings.paperTexture ?? 'classic') && settings.textureStrength!==0)
      await classicImage.decode();
    drawPaperGrain(texture,{paperWidth:width,paperHeight:height},settings,classicImage,0);
    substrate.append(texture);
    return {width,height,substrate,ornaments};
  }
  function motion() {
    if(!g)return;
    const feed=Math.max(0,number(caret.scrollOffset,0)), rolled=prefs.paperMotion==='roll';
    const {x,y}=callbacks.carriage ? callbacks.carriage(g) : carriagePosition(g,caret);
    css(shell,{'--carriage-x':x+'px','--rail-y':y+'px','--curl-offset':(rolled?0:-feed)+'px'});
    paintGrain(feed);
    const outlineKey=`${g.paperWidth}:${g.paperHeight}:${rolled?0:Math.min(104,feed)}:${prefs.curvedPaper!==false}`;
    if(lastFeed!==outlineKey){
      lastFeed=outlineKey;
      const path=paperOutline(g.paperWidth,g.paperHeight,rolled?0:feed,prefs.curvedPaper!==false);
      shell.style.setProperty('--paper-outline',`path("${path.outline}")`);lip.setAttribute('d',path.lip);
    }
    if(margin.hasChildNodes()) margin.style.transform=`translateY(${-feed}px)`;
    const embossY=77-feed, bend=Math.max(1,Math.min(180,g.editorHeight*.72));
    const progress=clamp((embossY+bend)/(2*bend),0,1);
    const project=(y)=>y>=bend?y:Math.sign(y+bend)*(y+bend)**2/(4*bend);
    const sx=rolled?.88+.12*progress:1, sy=rolled?Math.max(.02,(project(embossY+48)-project(embossY-48))/96):1;
    const markX=g.paperWidth/2+(Math.max(60,g.paperWidth-77)-g.paperWidth/2)*sx;
    const markY=rolled?project(embossY):embossY;
    css(emboss,{'left':markX+'px','top':markY+'px','transform':`translate(-50%,-50%) scale(${sx},${sy})`});
    const showMark=!!lastEmboss && lastEmboss!=='none' && feed<(rolled?310:130);
    show(emboss,showMark);
    show(beam,!!prefs.nightMode&&!callbacks.noCapsule&&!callbacks.noVeil);show(veil,!!prefs.nightMode&&!callbacks.noVeil);
    if(!prefs.nightMode || callbacks.noVeil || (lastPosition && lastPosition.x===x && lastPosition.y===y && lastPosition.feed===feed))return;
    lastPosition={x,y,feed};
    const v=setupCanvas(veil,g.paperWidth,g.paperHeight);
    v.globalAlpha=1;v.globalCompositeOperation='source-over';v.fillStyle='rgba(0,0,0,.80)';
    v.fillRect(0,0,g.paperWidth,g.paperHeight);
    v.globalCompositeOperation='destination-out';
    if(!callbacks.noCapsule){
      const dx=x-360,dy=y-22-416;
      const b=setupCanvas(beam,g.paperWidth,g.paperHeight);b.globalAlpha=.78;
      b.drawImage(capsuleTint.bitmap,dx,dy);
      v.globalAlpha=appearance.intensity;
      v.drawImage(masks.get('capsule'),dx,dy);
    }
    if(edgeMask){
      v.globalAlpha=appearance.intensity*.92;
      drawPair(v,edgeMask,0,0,42,g.paperHeight,g.paperWidth);
    }
    if(showMark && relief>0){
      const rim=embossRim(lastEmboss,makerImage);
      if(rim){
        v.globalAlpha=relief*(.22+.28*appearance.intensity);
        v.drawImage(rim,markX-48*sx,markY-48*sy,96*sx,96*sy);
      }
    }
    v.globalAlpha=1;v.globalCompositeOperation='source-over';
  }
  function schedule() {
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(!destroyed)motion();});
  }
  function resize() {
    if(destroyed)return;
    layout();paintLamps();motion();
  }
  function update(settings = {}) {
    prefs={...defaults,...settings};
    customize();resize();
  }
  if(callbacks.preview){
    shell.classList.add('ink-desk__shell--preview');
    if(callbacks.noCapsule){show(rail,false);show(capsule,false);}
    shell.setAttribute('aria-hidden','true');

  }
  const observer=new ResizeObserver(resize);
  if(!callbacks.preview)observer.observe(root);
  if(!callbacks.preview){
    capsule.addEventListener('mousedown', e=>e.preventDefault());
    capsule.addEventListener('click',()=>callbacks.toggleNight?.());
  }
  classicImage.addEventListener('load',schedule);
  classicImage.src=asset('paper-grain.png');
  update();
  return {surface,header,controls,footer,update,resize,printPaper,
    move(next = {}){caret={...next};schedule();},
    strike(){capsule.classList.add('ink-desk__capsule--strike');clearTimeout(strikeTimer);
      strikeTimer=setTimeout(()=>capsule.classList.remove('ink-desk__capsule--strike'),65);},
    showCapsule(showIt){show(rail,showIt);show(capsule,showIt);},
    destroy(){destroyed=true;observer.disconnect();cancelAnimationFrame(frame);clearTimeout(strikeTimer);shell.remove();}};
}

export function mountDeskPreview(root, settings = {}, mode = 'desk') {
  const container=document.createElement('div');
  container.className='ink-desk__preview'; root.append(container);
  const noCapsule=mode==='desk';
  const machine=mode==='machine';
  const carriageFraction={machine:.5,paper:.52}[mode] ?? .55;
  let prefs={...defaults,...settings};
  let desk, logicalKey='';
  function render(){
    const {width,height}=root.getBoundingClientRect();
    if(!width||!height)return;
    let scale=1;
    if(mode==='desk') scale=width/1080;
    // Fit the full hammer and capsule in a tile, keeping the large preview at desk scale.
    if(machine) scale=Math.min(1,height/108,width/154);
    const logicalWidth=width/scale, logicalHeight=mode==='desk'?Math.max(400,height/scale):height/scale;
    container.style.transform=`scale(${scale})`;
    const key=`${logicalWidth}:${logicalHeight}`;
    if(logicalKey!==key){
      logicalKey=key;const sampleNodes=desk?[...desk.surface.childNodes]:[];desk?.destroy();
      container.style.width=logicalWidth+'px';container.style.height=logicalHeight+'px';
      desk=mountDesk(container,{preview:true,noCapsule,noVeil:mode==='paper'||machine,fullWidth:mode!=='desk',width:logicalWidth,height:logicalHeight,
        paperHeight:mode==='desk'?Math.max(180,logicalHeight-42):logicalHeight,
        carriage:g=>({x:g.paperWidth*carriageFraction,
          y:mode==='paper'?Math.min(g.paperHeight-20,prefs.paperStartPosition==='bottom'?158:128)
            :mode==='lamp'?g.paperHeight-42:g.paperHeight*.56})});
      container.firstElementChild.dataset.previewMode=mode;
      if(sampleNodes.length) desk.surface.append(...sampleNodes);
      if(!sampleNodes.length && mode==='lamp'){
        const sample=document.createElement('div');
        sample.className='ink-desk__lamp-sample';sample.textContent='Мягкий свет.\nТишина за столом.';
        desk.surface.append(sample);
      }
    }
    desk.update({...prefs,focusMode:false,
      ...(mode!=='desk'?{deskAccent:'none',deskFinish:'charcoal'}:{}),
      ...(machine?{curvedPaper:false,paperEmbossing:'none',marginStyle:'none'}:{})});
    if(mode==='paper')desk.showCapsule(prefs.paperMotion==='roll');
  }
  const observer=new ResizeObserver(render);observer.observe(root);render();
  return {get surface(){return desk?.surface;},update(settings){prefs={...defaults,...settings};render();},destroy(){observer.disconnect();desk?.destroy();container.remove();}};
}
