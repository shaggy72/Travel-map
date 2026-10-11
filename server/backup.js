// Dagelijkse back-up van de SQLite-database. Consistente kopie via VACUUM INTO (veilig terwijl de app draait),
// oude kopieën worden na `keepDays` dagen verwijderd. system.luyens.be bewaakt of de nieuwste kopie vers is
// (zet de map in BACKUP_DIRS in de .env van system).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function backupDatabase(db, dir, { name = 'app', now = new Date(), keepDays = 14, files = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Zonder database (db = null, bv. een app met enkel JSON-bestanden) bestaat alleen het bestandsarchief.
  const file = db ? path.join(dir, `${name}-${stamp(now)}.db`) : null;
  if (db) {
    if (fs.existsSync(file)) fs.rmSync(file);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    try { fs.chmodSync(file, 0o600); } catch { /* Windows kent geen chmod */ }
  }

  // Bestanden naast de database (uploads, foto's): één tar.gz per back-up, van de mappen die bestaan.
  // `tar` zit op Linux en Windows 10+. Mislukt het archief, dan blijft de database-back-up staan en melden we de fout.
  let filesFile = null, filesError = null;
  const present = files.filter((f) => fs.existsSync(f));
  if (present.length) {
    filesFile = path.join(dir, `${name}-files-${stamp(now)}.tar.gz`);
    try {
      // -C <ouder> <mapnaam>: relatieve paden in het archief, dus terug te zetten op elke plek.
      execFileSync('tar', ['-czf', path.basename(filesFile), ...present.flatMap((f) => ['-C', path.dirname(f), path.basename(f)])], { cwd: dir, stdio: 'pipe' }); // relatieve naam: GNU tar op Windows leest "C:" als computernaam
      try { fs.chmodSync(filesFile, 0o600); } catch { /* Windows kent geen chmod */ }
    } catch (e) { filesError = String(e.stderr || e.message).trim().split(/\r?\n/)[0]; fs.rmSync(filesFile, { force: true }); filesFile = null; }
  }

  const re = new RegExp(`^${escRe(name)}-(files-)?\\d{8}-\\d{6}\\.(db|tar\\.gz)$`);
  const cutoff = now.getTime() - keepDays * 86400000;
  const removed = [];
  for (const f of fs.readdirSync(dir)) {
    if (re.test(f) && fs.statSync(path.join(dir, f)).mtimeMs < cutoff) { fs.rmSync(path.join(dir, f)); removed.push(f); }
  }
  return { file, filesFile, filesError, removed };
}

// Uur en minuut in Belgische tijd, zodat "03:30" altijd 03:30 in België is.
function brussels(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

const newestAgeHours = (dir, name, now) => {
  try {
    const re = new RegExp(`^${escRe(name)}-(files-)?\\d{8}-\\d{6}\\.(db|tar\\.gz)$`);
    const ts = fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => fs.statSync(path.join(dir, f)).mtimeMs);
    return ts.length ? (now.getTime() - Math.max(...ts)) / 3600000 : Infinity;
  } catch { return Infinity; }
};

/**
 * Plant dagelijks een back-up. Gebruik in index.js: startBackups(db, { dir: process.env.BACKUP_DIR, name: 'naam' })
 * `db` mag `null` zijn voor een app zonder database (dan enkel het archief van `files`). Optioneel `files: [absolute mappen]` (uploads, foto's) gaan als tar.gz mee in dezelfde back-up.
 * Zonder `dir` gebeurt er niets (lokaal/testen). Bij het opstarten wordt meteen een back-up gemaakt als de
 * nieuwste ouder is dan 26 uur, zodat een herstart rond het geplande uur geen dag overslaat.
 */
export function startBackups(db, { dir, name = 'app', files = [], at = '03:30', keepDays = 14, log = console.log, now = () => new Date() } = {}) {
  if (!dir) return null;
  let lastDay = null;
  const run = () => {
    try {
      const { removed, filesFile, filesError } = backupDatabase(db, dir, { name, keepDays, files, now: now() });
      if (filesError) console.error(`back-up van bestanden mislukt: ${filesError}`);
      lastDay = brussels(now()).day;
      log(`back-up gemaakt${filesFile ? ' (met bestanden)' : ''}, ${removed.length} oude verwijderd`);
    } catch (e) { console.error(`back-up mislukt: ${e.message}`); }
  };
  if (newestAgeHours(dir, name, now()) > 26) run();
  const timer = setInterval(() => {
    const b = brussels(now());
    if (b.hm === at && b.day !== lastDay) run();
  }, 30_000);
  timer.unref();
  return timer;
}
