#!/usr/bin/env node
/**
 * Render cv/resume.yaml with RenderCV.
 *
 *   node scripts/render-cv.mjs public <out-dir>   phone line removed (website, anything public)
 *   node scripts/render-cv.mjs full <out-dir>     phone filled from CV_PHONE (env, or a gitignored .env)
 *
 * Writes <out-dir>/Sean_Ernstes_Resume.pdf and nothing else.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [mode, outArg] = process.argv.slice(2);
if (!['public', 'full'].includes(mode) || !outArg) {
	console.error('usage: render-cv.mjs public|full <out-dir>');
	process.exit(2);
}

const PLACEHOLDER = /^[ \t]*phone:[ \t]*\$\{CV_PHONE\}[ \t]*\r?\n/m;
const src = readFileSync('cv/resume.yaml', 'utf8');
if (!PLACEHOLDER.test(src)) {
	console.error('cv/resume.yaml needs a "phone: ${CV_PHONE}" line.');
	process.exit(1);
}

let yaml = src.replace(PLACEHOLDER, '');
if (mode === 'full') {
	const phone = process.env.CV_PHONE || readDotEnv('CV_PHONE');
	if (!phone) {
		console.error('CV_PHONE is not set (env var or .env).');
		process.exit(1);
	}
	yaml = src.replace(PLACEHOLDER, (line) => line.replace('${CV_PHONE}', JSON.stringify(phone)));
}

// render from a scratch folder so the filled-in YAML and Typst source never sit next to the output
const out = resolve(outArg);
const work = join(out, '.render');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
writeFileSync(join(work, 'resume.yaml'), yaml);
try {
	execFileSync(
		'rendercv',
		['render', join(work, 'resume.yaml'), '--output-folder', work, '--dont-generate-png', '--dont-generate-html', '--dont-generate-markdown'],
		{ stdio: ['ignore', 'ignore', 'inherit'] }
	);
	const pdf = readdirSync(work).find((f) => f.endsWith('.pdf'));
	if (!pdf) throw new Error('RenderCV produced no PDF.');
	renameSync(join(work, pdf), join(out, 'Sean_Ernstes_Resume.pdf'));
} finally {
	rmSync(work, { recursive: true, force: true });
}
console.log(join(outArg, 'Sean_Ernstes_Resume.pdf'));

function readDotEnv(key) {
	if (!existsSync('.env')) return '';
	const m = readFileSync('.env', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
	return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
