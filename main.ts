// main.ts — MARAVILLA entrypoint (Node 22, standard library only).
//
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory (MAKEFUN_OUTPUT_DIR outside the grader,
// /output inside it) and writes /output/dossier.json with buildDossier
// from vendor/makefun-game.ts.
//
// Deterministic by construction: entries are copied in sorted order,
// file bytes are copied verbatim, and the dossier is built from those
// bytes alone — no timestamps, no randomness, no environment data. Two
// runs write byte-identical output.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR: string = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const DOSSIER_TEXT_MAX_BYTES: number = 163840;

// Copy one directory tree verbatim, entries in sorted order so the walk
// is stable run to run. Only regular files and directories are copied.
async function copyTree(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await writeFile(to, await readFile(from));
    }
  }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Start from a clean slate so stale files from an earlier run can
  // never leak into the output.
  await rm(join(OUTPUT_DIR, 'game'), { recursive: true, force: true });
  await rm(join(OUTPUT_DIR, 'screenshots'), { recursive: true, force: true });
  await rm(join(OUTPUT_DIR, 'dossier.json'), { force: true });

  await copyTree(join(REPO_ROOT, 'game'), join(OUTPUT_DIR, 'game'));
  await copyTree(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'));

  const dossier: Uint8Array = buildDossier(OUTPUT_DIR, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
  });
  await writeFile(join(OUTPUT_DIR, 'dossier.json'), dossier);

  console.log(`MARAVILLA written to ${OUTPUT_DIR}`);
}

await main();
