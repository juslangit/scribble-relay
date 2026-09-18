/* The effects layer (fx.js), checked in headless Chrome.

   What matters about it is mostly what it must NOT do: take a tap, cost
   anything while someone draws, or break the game if Phaser is missing. So
   most of these checks are about that, and the rest confirm the effects and
   sounds actually happen. */
const { launch, Session, sleep } = require('./cdp.js');
const fs = require('fs');

let pass = 0, fail = 0;
const ok = (c, msg, extra = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${msg.padEnd(58)}${extra}`); };
const URL = 'http://localhost:8766/index.html';
const SHOTS = `${__dirname}/shots`;

async function open(dev, { block = [], media = [] } = {}) {
  const s = await Session.open('about:blank');
  await s.send('Page.enable'); await s.send('Runtime.enable'); await s.send('Log.enable');
  await s.send('Network.enable');
  if (block.length) await s.send('Network.setBlockedURLs', { urls: block });
  if (media.length) await s.send('Emulation.setEmulatedMedia', { features: media });
  await s.send('Emulation.setDeviceMetricsOverride', { width: dev.width, height: dev.height, deviceScaleFactor: dev.scale, mobile: dev.mobile });
  if (dev.mobile) await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.send('Page.navigate', { url: URL });
  await sleep(1500);
  await s.eval(`localStorage.clear()`);
  s.stats = () => s.eval(`FX.stats()`);
  s.visible = () => s.eval(`[...document.querySelectorAll('.screen')].find(x => !x.hidden).id`);
  s.centre = sel => s.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  s.errors = () => s.events.filter(e => (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/fonts\.g/.test(e.params.entry.url || '')) || e.method === 'Runtime.exceptionThrown');
  // Wait until the layer has gone back to sleep, or give up.
  s.asleep = async (ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (!(await s.stats()).awake) return true; await sleep(100); } return false; };
  return s;
}

async function main(dev) {
  const tag = `${dev.name} (${process.env.CDP_WEBGL ? 'webgl' : 'canvas'}):`;
  const s = await open(dev);

  // ---- it is there, and it is out of the way ----
  // It starts in the background -- Phaser boots after the page and decodes the
  // sounds -- so give it time, and say how long it took.
  const t0 = Date.now();
  while (Date.now() - t0 < 8000 && !(await s.stats()).ready) await sleep(100);
  const st = await s.stats();
  ok(true, `${tag} ready after`, `${Date.now() - t0 + 1500} ms from navigation (at most)`);
  ok(st.ready, `${tag} effects layer starts`, st.renderer);
  const want = process.env.CDP_WEBGL ? 'webgl' : 'canvas';
  ok(st.renderer === want, `${tag} draws with ${want}`, st.renderer);
  ok(st.sounds === 8, `${tag} all 8 sounds decoded`, `${st.sounds}`);
  const box = await s.eval(`(() => { const c = document.getElementById('fx-layer'); const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
    return { pe: cs.pointerEvents, pos: cs.position, w: r.width, h: r.height, bw: c.width, iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }; })()`);
  ok(box.pe === 'none', `${tag} ignores touches (pointer-events: none)`);
  ok(box.pos === 'fixed' && Math.abs(box.w - box.iw) < 1 && Math.abs(box.h - box.ih) < 1, `${tag} covers exactly the screen`, `${box.w}x${box.h}`);
  ok(box.bw === Math.round(box.iw * Math.min(box.dpr, 2)), `${tag} sharp on this screen`, `backing ${box.bw}px for ${box.iw}px`);
  ok(await s.eval(`document.documentElement.scrollHeight <= innerHeight + 1`), `${tag} adds nothing to the page's height`);

  ok(await s.asleep(), `${tag} sleeps when nothing is playing`);
  ok(await s.eval(`getComputedStyle(document.getElementById('fx-layer')).visibility === 'hidden'`), `${tag} and is hidden while asleep`);

  // ---- a burst wakes it, and it goes back to sleep on its own ----
  await s.eval(`FX.burst('#go-setup', { kind: 'star', count: 30 })`);
  await sleep(120);
  const mid = await s.stats();
  ok(mid.awake && mid.alive > 0, `${tag} a burst wakes it`, `${mid.alive} alive`);
  // a real click, right through the burst, still lands on the button
  const [bx, by] = await s.centre('#go-setup');
  ok(await s.eval(`document.elementFromPoint(${bx}, ${by}).id === 'go-setup'`), `${tag} the button under a burst is still the thing hit`);
  await s.click(bx, by); await sleep(400);
  ok(await s.visible() === 'setup', `${tag} a real tap through a burst works`);
  ok(await s.asleep(), `${tag} back to sleep after the burst`);

  // ---- sound: locked until a real tap, then the real samples play ----
  const after = await s.stats();
  ok(!after.locked, `${tag} sound unlocked by the first real tap`);
  ok(await s.eval(`FX.sound('tap')`), `${tag} a real sample plays`);

  // ---- confetti ----
  await s.eval(`FX.confetti()`); await sleep(500);
  const c = await s.stats();
  ok(c.alive > 60, `${tag} confetti flies`, `${c.alive} pieces`);
  await s.shot(`${SHOTS}/${dev.name}-fx-confetti.png`);
  ok(await s.asleep(5000), `${tag} confetti clears and it sleeps again`);

  // ---- drawing costs nothing: the layer stays asleep the whole time ----
  await s.eval(`(() => { const ins = document.querySelectorAll('#player-list input'); ['Aina','Hafiz','Siti'].forEach((n,i)=>{ ins[i].value=n; ins[i].dispatchEvent(new Event('input')); }); })()`);
  await s.eval(`document.querySelector('.seg[data-key=sound] button[data-v="0"]').click()`);
  await s.eval(`document.querySelector('#start-game').click()`); await sleep(500);
  await s.eval(`document.querySelector('#pass-go').click()`); await sleep(300);
  await s.eval(`(() => { const i = document.querySelector('#write-input'); i.value = 'A cat robbing a bank'; i.dispatchEvent(new Event('input')); document.querySelector('#write-done').click(); })()`);
  await sleep(150);
  const handed = await s.stats();
  ok(handed.awake && handed.alive > 0, `${tag} handing a turn over sprays stars`, `${handed.alive} alive`);
  await s.shot(`${SHOTS}/${dev.name}-fx-pass.png`);
  await sleep(1100);
  await s.eval(`document.querySelector('#pass-go').click()`); await sleep(300);
  ok(await s.visible() === 'draw', `${tag} on to the drawing screen`);
  ok(await s.asleep(), `${tag} asleep before drawing starts`);
  const sleepsBefore = (await s.stats()).sleeps;
  const pad = await s.eval(`(() => { const r = document.querySelector('#pad').getBoundingClientRect(); return [r.left, r.top, r.width]; })()`);
  const type = dev.mobile ? 'touch' : 'mouse';
  const point = (x, y) => type === 'touch'
    ? [{ x, y, id: 1 }]
    : { x, y };
  let wokeWhileDrawing = false;
  for (let k = 0; k < 3; k++) {
    const y = pad[1] + pad[2] * (0.3 + k * 0.2);
    const pts = Array.from({ length: 12 }, (_, i) => [pad[0] + pad[2] * (0.15 + i * 0.06), y]);
    if (type === 'touch') {
      await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(...pts[0]) });
      for (const p of pts.slice(1)) { await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(...p) }); await sleep(16); }
      await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', buttons: 1, clickCount: 1 });
      for (const p of pts.slice(1)) { await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(16); }
      await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pts.at(-1)[0], y: pts.at(-1)[1], button: 'left', buttons: 0, clickCount: 1 });
    }
    if ((await s.stats()).awake) wokeWhileDrawing = true;
  }
  const strokes = await s.eval(`pad.export().length`);
  ok(strokes > 3000, `${tag} the strokes were drawn`, `${strokes} chars of PNG`);
  const afterDraw = await s.stats();
  ok(!wokeWhileDrawing && afterDraw.sleeps === sleepsBefore, `${tag} the layer never woke while drawing`);

  // ---- time running out: red flash and a shake ----
  await s.eval(`submitTurn(pad.export(), true)`); await sleep(80);
  const late = await s.stats();
  ok(late.awake, `${tag} time's up flashes the screen`);
  await s.shot(`${SHOTS}/${dev.name}-fx-timesup.png`);

  const errs = s.errors();
  ok(errs.length === 0, `${tag} no console errors`, errs.map(e => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  await s.close();
}

/* Reduce-motion on: no flash, no shake, far less confetti. */
async function reducedMotion(dev) {
  const tag = dev.name + ' reduced motion:';
  const s = await open(dev, { media: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  ok((await s.stats()).reduceMotion, `${tag} setting is read`);
  ok(!(await s.eval(`FX.flash('#ff0000')`)), `${tag} no flash`);
  ok(!(await s.eval(`FX.shake(document.body)`)), `${tag} no shake`);
  await s.eval(`FX.confetti()`); await sleep(300);
  const n = (await s.stats()).alive;
  ok(n > 0 && n <= 30, `${tag} only a little confetti`, `${n} pieces`);
  await s.close();
}

/* Phaser blocked from loading: the game must still play, with its beeps. */
async function withoutPhaser(dev) {
  const tag = dev.name + ' without Phaser:';
  const s = await open(dev, { block: ['*phaser.min.js'] });
  ok(await s.eval(`typeof Phaser === 'undefined'`), `${tag} Phaser really is missing`);
  ok(!(await s.eval(`FX.ready`)) && !(await s.eval(`FX.sound('tap')`)), `${tag} effects say no, quietly`);
  await s.eval(`document.querySelector('#go-setup').click()`); await sleep(300);
  ok(await s.visible() === 'setup', `${tag} the game still plays`);
  await s.eval(`sfx.tap(); FX.confetti(); FX.burst('#start-game')`);
  const errs = s.errors().filter(e => !/phaser\.min\.js/.test(JSON.stringify(e.params)));
  ok(errs.length === 0, `${tag} no errors`, errs.map(e => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  await s.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await launch();
  const phone = { name: 'phone', width: 390, height: 844, mobile: true, scale: 3 };
  const desktop = { name: 'desktop', width: 1440, height: 900, mobile: false, scale: 1 };
  await main(phone);
  await main(desktop);
  await reducedMotion(phone);
  await withoutPhaser(phone);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
