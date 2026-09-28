/**
 * Regenerates the app icons in webapp/public/ from webapp/public/favicon.svg:
 * favicon.ico (16+32), apple-touch-icon.png (180), icon-192.png, icon-512.png
 * and icon-maskable-512.png (route scaled into Android's 80% safe zone).
 *
 * Uses a locally installed Chrome/Edge in headless mode as the rasteriser
 * (no image libraries in this project). Usage:
 *   node scripts/render-icons.cjs
 *   CHROME_PATH="/path/to/chrome" node scripts/render-icons.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PUB = path.join(__dirname, '..', 'webapp', 'public');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-icons-'));

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const CHROME = CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) throw new Error('No Chrome/Edge found — set CHROME_PATH');

const main = fs.readFileSync(path.join(PUB, 'favicon.svg'), 'utf8');
// Maskable: same stripes, route group scaled to 72% around the centre so the
// end dots survive Android's circle/squircle crop.
const maskable = main
  .replace('<path d=', '<g transform="translate(256 256) scale(0.72) translate(-256 -256)"><path d=')
  .replace('</svg>', '</g></svg>');

function render(svg, size, out) {
  const html = path.join(TMP, `icon-${size}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--user-data-dir=${path.join(TMP, 'profile')}`, '--force-device-scale-factor=1',
    `--window-size=${size},${size}`, '--default-background-color=00000000',
    `--screenshot=${out}`, 'file:///' + html.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  console.log(path.basename(out));
}

render(main, 180, path.join(PUB, 'apple-touch-icon.png'));
render(main, 192, path.join(PUB, 'icon-192.png'));
render(main, 512, path.join(PUB, 'icon-512.png'));
render(maskable, 512, path.join(PUB, 'icon-maskable-512.png'));
render(main, 16, path.join(TMP, 'fav-16.png'));
render(main, 32, path.join(TMP, 'fav-32.png'));

// favicon.ico with embedded PNGs (supported by every current browser)
const sizes = [16, 32];
const pngs = sizes.map(s => fs.readFileSync(path.join(TMP, `fav-${s}.png`)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0); e.writeUInt8(sizes[i], 1);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs]));
console.log('favicon.ico');
fs.rmSync(TMP, { recursive: true, force: true });
