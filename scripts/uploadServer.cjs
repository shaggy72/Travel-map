/**
 * Minimal GPX upload server — no external dependencies.
 * Saves uploaded .gpx files to /public and re-runs syncGpxFiles.cjs
 * so the Remotion Studio dropdown updates via HMR.
 *
 * Start via:  npm run upload-server   (or automatically via npm start)
 * Open:       http://localhost:3001
 */
const http         = require("http");
const fs           = require("fs");
const path         = require("path");
const { execFileSync } = require("child_process");

const PORT       = 3001;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SYNC_SCRIPT = path.join(__dirname, "syncGpxFiles.cjs");

// ── HTML ───────────────────────────────────────────────────────────────────
function page(msg = "") {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GPX Upload</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #fff;
      border-radius: 14px;
      padding: 44px 52px;
      box-shadow: 0 6px 32px rgba(0,0,0,.10);
      width: 100%;
      max-width: 500px;
    }
    h1 { font-size: 1.45rem; color: #111; margin-bottom: 6px; }
    .sub { color: #6b7280; font-size: .88rem; margin-bottom: 30px; line-height: 1.55; }
    code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-size: .85em; }
    .drop-zone {
      border: 2px dashed #d1d5db;
      border-radius: 10px;
      padding: 36px 20px;
      text-align: center;
      cursor: pointer;
      transition: border-color .2s, background .2s;
      color: #6b7280;
      font-size: .95rem;
      user-select: none;
    }
    .drop-zone:hover,
    .drop-zone.over { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
    .drop-zone .icon { font-size: 2.4rem; margin-bottom: 10px; }
    input[type=file] { display: none; }
    #chosen { margin-top: 10px; font-size: .85rem; color: #2563eb; min-height: 1.3em; }
    .btn {
      display: block;
      margin-top: 22px;
      width: 100%;
      padding: 13px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 9px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .18s;
    }
    .btn:hover { background: #1d4ed8; }
    .btn:disabled { background: #93c5fd; cursor: not-allowed; }
    .msg { margin-top: 18px; padding: 13px 16px; border-radius: 9px; font-size: .9rem; line-height: 1.5; }
    .ok  { background: #d1fae5; color: #065f46; }
    .err { background: #fee2e2; color: #991b1b; }
    .files { margin-top: 26px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    .files h2 { font-size: .95rem; color: #374151; margin-bottom: 10px; }
    .files ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .files li {
      padding: 8px 12px;
      background: #f9fafb;
      border-radius: 7px;
      font-size: .88rem;
      color: #374151;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Upload GPX file</h1>
    <p class="sub">
      The file will be saved to <code>/public</code> and the
      <em>gpxFile</em> dropdown in Remotion Studio will update automatically.
    </p>

    <form id="form" method="POST" action="/upload" enctype="multipart/form-data">
      <label class="drop-zone" id="dropZone" for="fileInput">
        <div class="icon">📂</div>
        Drag &amp; drop a <strong>.gpx</strong> file here<br>
        or click to browse
      </label>
      <input id="fileInput" type="file" name="file" accept=".gpx" required>
      <div id="chosen"></div>
      <button class="btn" id="uploadBtn" type="submit" disabled>Upload</button>
    </form>

    ${msg}

    ${existingFiles()}

    <script>
      const input   = document.getElementById('fileInput');
      const chosen  = document.getElementById('chosen');
      const btn     = document.getElementById('uploadBtn');
      const dropZone = document.getElementById('dropZone');

      input.addEventListener('change', () => {
        const name = input.files[0]?.name ?? '';
        chosen.textContent = name ? '📄 ' + name : '';
        btn.disabled = !name;
      });

      // Drag-and-drop
      ['dragenter','dragover'].forEach(e => dropZone.addEventListener(e, ev => {
        ev.preventDefault(); dropZone.classList.add('over');
      }));
      ['dragleave','drop'].forEach(e => dropZone.addEventListener(e, ev => {
        ev.preventDefault(); dropZone.classList.remove('over');
      }));
      dropZone.addEventListener('drop', ev => {
        const file = ev.dataTransfer.files[0];
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change'));
        }
      });
    </script>
  </div>
</body>
</html>`;
}

function existingFiles() {
  try {
    const files = fs.readdirSync(PUBLIC_DIR)
      .filter(f => f.toLowerCase().endsWith(".gpx"))
      .sort();
    if (files.length === 0) return "";
    const items = files.map(f => `<li>📍 ${f}</li>`).join("\n");
    return `<div class="files"><h2>Files already in /public</h2><ul>${items}</ul></div>`;
  } catch {
    return "";
  }
}

// ── Multipart parser ───────────────────────────────────────────────────────
function parseMultipart(body, boundary) {
  const bnd        = Buffer.from("--" + boundary);
  const crlfcrfl   = Buffer.from("\r\n\r\n");

  let pos = body.indexOf(bnd);
  if (pos === -1) return null;
  pos += bnd.length + 2; // skip \r\n after opening boundary

  const headerEnd = body.indexOf(crlfcrfl, pos);
  if (headerEnd === -1) return null;
  const headers = body.slice(pos, headerEnd).toString();

  const m = headers.match(/filename="([^"]+)"/i);
  if (!m) return null;
  const filename = path.basename(m[1]);

  const contentStart = headerEnd + 4;
  const endBnd       = Buffer.from("\r\n--" + boundary + "--");
  const contentEnd   = body.indexOf(endBnd, contentStart);
  if (contentEnd === -1) return null;

  return { filename, content: body.slice(contentStart, contentEnd) };
}

// ── HTTP server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const html = (status, body) => {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  };

  if (req.method === "GET" && req.url === "/") {
    return html(200, page());
  }

  if (req.method === "POST" && req.url === "/upload") {
    const ct = req.headers["content-type"] ?? "";
    const bm = ct.match(/boundary=(.+)$/);
    if (!bm) return html(400, page('<div class="msg err">Missing multipart boundary.</div>'));
    const boundary = bm[1].trim();

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body   = Buffer.concat(chunks);
        const result = parseMultipart(body, boundary);

        if (!result)
          return html(400, page('<div class="msg err">Could not parse the upload.</div>'));
        if (!result.filename.toLowerCase().endsWith(".gpx"))
          return html(400, page('<div class="msg err">Only .gpx files are accepted.</div>'));

        fs.writeFileSync(path.join(PUBLIC_DIR, result.filename), result.content);
        execFileSync(process.execPath, [SYNC_SCRIPT]);

        return html(200, page(
          `<div class="msg ok">✓ <strong>${result.filename}</strong> uploaded &amp; dropdown updated in Studio.</div>`
        ));
      } catch (err) {
        console.error("[upload-server] error:", err);
        return html(500, page(`<div class="msg err">Server error: ${err.message}</div>`));
      }
    });
    return;
  }

  html(404, "<p>Not found</p>");
});

server.listen(PORT, () => {
  console.log(`\x1b[33m[upload-server]\x1b[0m Ready → http://localhost:${PORT}`);
});
