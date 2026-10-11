import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { backupDatabase, startBackups } from '../backup.js';

const setup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const db = new DatabaseSync(path.join(dir, 'app.db'));
  db.exec('CREATE TABLE t (x TEXT); INSERT INTO t VALUES (\'hallo\')');
  return { dir, db, out: path.join(dir, 'backups') };
};

test('back-up is een volledige, leesbare kopie', () => {
  const { db, out } = setup();
  const { file } = backupDatabase(db, out, { name: 'demo' });
  assert.match(path.basename(file), /^demo-\d{8}-\d{6}\.db$/);
  assert.equal(new DatabaseSync(file).prepare('SELECT x FROM t').get().x, 'hallo');
});

test('oude back-ups worden opgeruimd, andere bestanden blijven', () => {
  const { db, out } = setup();
  fs.mkdirSync(out, { recursive: true });
  const oud = path.join(out, 'demo-20200101-030000.db');
  const vreemd = path.join(out, 'notities.txt');
  fs.writeFileSync(oud, 'x'); fs.writeFileSync(vreemd, 'x');
  const old = new Date(Date.now() - 30 * 86400000);
  fs.utimesSync(oud, old, old); fs.utimesSync(vreemd, old, old);
  const { removed } = backupDatabase(db, out, { name: 'demo', keepDays: 14 });
  assert.deepEqual(removed, ['demo-20200101-030000.db']);
  assert.ok(fs.existsSync(vreemd));
});

test('bij het opstarten komt er meteen een back-up als de nieuwste te oud is, anders niet', () => {
  const { db, out } = setup();
  const logs = [];
  const t1 = startBackups(db, { dir: out, name: 'demo', log: (m) => logs.push(m) });
  assert.equal(logs.length, 1);
  assert.equal(fs.readdirSync(out).length, 1);
  const t2 = startBackups(db, { dir: out, name: 'demo', log: (m) => logs.push(m) });
  assert.equal(logs.length, 1, 'verse back-up bestaat al');
  clearInterval(t1); clearInterval(t2);
});

test('zonder map gebeurt er niets', () => {
  assert.equal(startBackups(setup().db, {}), null);
});

test('bestandsmappen gaan als tar.gz mee, een ontbrekende map wordt overgeslagen, oude archieven worden opgeruimd', () => {
  const { dir, db, out } = setup();
  const uploads = path.join(dir, 'uploads');
  fs.mkdirSync(path.join(uploads, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(uploads, 'sub', 'foto.jpg'), 'pixels');
  fs.mkdirSync(out, { recursive: true });
  const oud = path.join(out, 'demo-files-20200101-030000.tar.gz');
  fs.writeFileSync(oud, 'x');
  const old = new Date(Date.now() - 30 * 86400000);
  fs.utimesSync(oud, old, old);

  const r = backupDatabase(db, out, { name: 'demo', files: [uploads, path.join(dir, 'bestaat-niet')] });
  assert.equal(r.filesError, null);
  assert.match(path.basename(r.filesFile), /^demo-files-\d{8}-\d{6}\.tar\.gz$/);
  const unpack = fs.mkdtempSync(path.join(os.tmpdir(), 'unpack-'));
  execFileSync('tar', ['-xzf', path.basename(r.filesFile), '-C', unpack], { cwd: out });
  assert.equal(fs.readFileSync(path.join(unpack, 'uploads', 'sub', 'foto.jpg'), 'utf8'), 'pixels');
  assert.deepEqual(r.removed, ['demo-files-20200101-030000.tar.gz']);
});

test('zonder bestaande bestandsmappen geen archief', () => {
  const { dir, db, out } = setup();
  assert.equal(backupDatabase(db, out, { name: 'demo', files: [path.join(dir, 'weg')] }).filesFile, null);
});

test('zonder database (db = null) komt er enkel een bestandsarchief', () => {
  const { dir, out } = setup();
  const data = path.join(dir, 'data');
  fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'users.json'), '[]');
  const r = backupDatabase(null, out, { name: 'json', files: [data] });
  assert.equal(r.file, null);
  assert.ok(fs.existsSync(r.filesFile));
  const logs = [];
  const t1 = startBackups(null, { dir: out, name: 'json', files: [data], log: (m) => logs.push(m) });
  assert.equal(logs.length, 0, 'een vers archief bestaat al, dus geen nieuwe bij het opstarten');
  clearInterval(t1);
});
