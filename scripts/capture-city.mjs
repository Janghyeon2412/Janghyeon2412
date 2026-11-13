// 잔디 도시 사이트를 열어 한 바퀴 도는 장면을 찍고 GIF로 만든다.
// 사용법: node scripts/capture-city.mjs <도시 주소> <저장할 gif 경로>
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const url = process.argv[2] || 'https://github-trailer.vercel.app/city/Janghyeon2412?capture=1';
const out = process.argv[3] || 'city.gif';
const FRAMES = Number(process.env.FRAMES || 48);
const FPS = Number(process.env.FPS || 8);
const W = Number(process.env.W || 800), H = Number(process.env.H || 400);

const dir = await mkdtemp(join(tmpdir(), 'city-'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.cityReady || window.cityError, null, { timeout: 120_000 });
  const err = await page.evaluate(() => window.cityError);
  if (err) throw new Error(`도시를 그리지 못했어요: ${err}`);
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((p) => window.cityRender(p), i / FRAMES);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, '0')}.png`) });
  }
} finally {
  await browser.close();
}

// 색을 96개로 줄인 팔레트를 만들어 GIF 용량을 줄인다
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%03d.png'),
  '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  '-loop', '0', out,
]);
await rm(dir, { recursive: true, force: true });
console.log(`saved ${out}`);
