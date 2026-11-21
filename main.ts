/* MARAVILLA — One Last Score. Entrypoint: builds the deterministic dossier (makefun/dossier/v1).
   Run by the grader as: node main.ts
   Writes the dossier bytes to stdout, and best-effort to dossier.json / $MAKEFUN_OUTPUT_DIR/dossier.json / argv[2].
   No network, no clock, no randomness: the same repo always produces the same bytes. */
import { buildDossier } from './vendor/makefun-game.ts';
import { writeFileSync } from 'node:fs';

const CAPS = {
  text_max_bytes: 1500000,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
};

const dossier = await buildDossier('.', CAPS);
const bytes = Buffer.from(dossier);

/* Guard: the dossier must fit the 1.5 MiB cap the kit enforces — fail loudly
   here instead of shipping an oversized blob the grader rejects. */
if (bytes.length > CAPS.text_max_bytes) {
  console.error('dossier: ' + bytes.length + ' bytes EXCEEDS cap ' + CAPS.text_max_bytes);
  process.exit(1);
}

process.stdout.write(bytes);

function tryWrite(path: string): void {
  try { writeFileSync(path, bytes); } catch { /* read-only mount: stdout already carries the dossier */ }
}
tryWrite('dossier.json');
const outDir = process.env.MAKEFUN_OUTPUT_DIR;
if (outDir) tryWrite(outDir + '/dossier.json');
const argvPath = process.argv[2];
if (argvPath) tryWrite(argvPath);

console.error('dossier: ' + bytes.length + ' bytes');
