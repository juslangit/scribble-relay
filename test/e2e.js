/* Plays a whole game through the real UI at phone, tablet and desktop sizes,
   drawing with real pointer input, and screenshots every screen. */
const { launch, Session, sleep } = require('./cdp.js');
const fs = require('fs');

let pass = 0, fail = 0;
const ok = (c, msg, extra = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${msg.padEnd(52)}${extra}`); };
const URL = 'http://localhost:8766/index.html';
const DEVICES = [
  { name: 'phone', width: 390, height: 844, mobile: true, scale: 3 },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true, scale: 3 },
  { name: 'tablet', width: 820, height: 1180, mobile: true, scale: 2 },
  { name: 'desktop', width: 1440, height: 900, mobile: false, scale: 1 },
];

async function play(dev) {
  const s = await Session.open('about:blank');
  await s.send('Page.enable'); await s.send('Runtime.enable'); await s.send('Log.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: dev.width, height: dev.height, deviceScaleFactor: dev.scale, mobile: dev.mobile });
  if (dev.mobile) await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.send('Page.navigate', { url: URL });
  await sleep(1500);
  await s.eval(`localStorage.clear(); location.reload()`).catch(() => {});
  await sleep(1500);
  const dir = `${__dirname}/shots`;
  const shot = n => s.shot(`${dir}/${dev.name}-${n}.png`);
  const click = sel => s.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel}'); el.click(); return true; })()`);
  const visible = () => s.eval(`[...document.querySelectorAll('.screen')].find(x => !x.hidden).id`);
  const noHScroll = async label => {
    const w = await s.eval(`(() => { const sc = [...document.querySelectorAll('.screen')].find(x => !x.hidden); return sc.scrollWidth - sc.clientWidth; })()`);
    ok(w <= 1, `${dev.name}: no sideways scroll on ${label}`, `overflow ${w}px`);
  };
  const tag = `${dev.name}:`;

  await shot('1-home'); await noHScroll('home');
  await click('#go-setup'); await sleep(300);
  ok(await visible() === 'setup', `${tag} setup opens`);
  // name 3 players, then add a 4th and remove it again
  await s.eval(`(() => { const ins = document.querySelectorAll('#player-list input'); ['Luqman','Aina','Hafiz','Siti'].forEach((n,i)=>{ ins[i].value=n; ins[i].dispatchEvent(new Event('input')); }); })()`);
  await click('#add-player'); await sleep(50);
  ok(await s.eval(`document.querySelectorAll('#player-list input').length`) === 5, `${tag} add player`);
  await click('#player-list .player-row:last-child button'); await sleep(50);
  await click('.seg[data-key=drawSec] button[data-v="30"]');
  await click('.seg[data-key=sound] button[data-v="0"]');
  await shot('2-setup'); await noHScroll('setup');
  await click('#start-game'); await sleep(500);

  // turn 0: write
  ok(await visible() === 'pass', `${tag} pass screen after start`);
  ok((await s.eval(`document.querySelector('#pass-name').textContent`)) === 'Luqman', `${tag} first player is Luqman`);
  await shot('3-pass');
  await click('#pass-go'); await sleep(300);
  ok(await visible() === 'write', `${tag} write screen`);
  await click('#write-dice');
  await s.eval(`(() => { const i = document.querySelector('#write-input'); i.value = 'A shark riding a bicycle'; i.dispatchEvent(new Event('input')); })()`);
  await shot('4-write');
  await click('#write-done'); await sleep(1300);

  // turn 1: draw with real input
  ok((await s.eval(`document.querySelector('#pass-name').textContent`)) === 'Aina', `${tag} second player is Aina`);
  await click('#pass-go'); await sleep(500);
  ok(await visible() === 'draw', `${tag} draw screen`);
  ok((await s.eval(`document.querySelector('#draw-prompt').textContent`)) === 'A shark riding a bicycle', `${tag} drawer sees the phrase`);
  const r = JSON.parse(await s.eval(`JSON.stringify(document.querySelector('#pad').getBoundingClientRect())`));
  ok(r.width >= 200 && Math.abs(r.width - r.height) < 1, `${tag} canvas is square and usable`, `${Math.round(r.width)}x${Math.round(r.height)}`);
  ok(r.right <= dev.width && r.bottom <= dev.height, `${tag} canvas fully on screen`);
  const toolsBottom = await s.eval(`document.querySelector('#draw-done').getBoundingClientRect().bottom`);
  ok(toolsBottom <= dev.height, `${tag} Done button on screen`, `bottom ${Math.round(toolsBottom)} / ${dev.height}`);
  const drawLine = async (pts) => {
    if (dev.mobile) {
      await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
      for (const p of pts.slice(1)) await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] });
      await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', buttons: 1, clickCount: 1 });
      for (const p of pts.slice(1)) await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 });
      await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pts.at(-1)[0], y: pts.at(-1)[1], button: 'left', buttons: 0, clickCount: 1 });
    }
  };
  const P = (fx, fy) => [r.left + r.width * fx, r.top + r.height * fy];
  const arc = (cx, cy, rad, n = 24, from = 0, to = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = from + (to - from) * i / n; return P(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); });
  await drawLine(arc(.3, .72, .12));             // wheel
  await drawLine(arc(.7, .72, .12));             // wheel
  await click('.swatch[data-color="#2a9df4"]');
  await click('.tool[data-size="2"]');
  await drawLine([P(.2, .45), P(.4, .3), P(.6, .28), P(.8, .42), P(.6, .5), P(.3, .5), P(.2, .45)]); // shark body
  await drawLine([P(.5, .29), P(.55, .15), P(.62, .28)]); // fin
  await drawLine([P(.1, .1), P(.9, .9)]);        // mistake...
  const strokesBefore = await s.eval(`(() => { const c = document.querySelector('#pad'); const d = c.getContext('2d').getImageData(0,0,1024,1024).data; let n=0; for (let i=0;i<d.length;i+=4*7) if (d[i]<250||d[i+1]<250||d[i+2]<250) n++; return n; })()`);
  ok(strokesBefore > 500, `${tag} pointer input draws on the canvas`, `${strokesBefore} inked samples`);
  await click('#tool-undo'); await sleep(100);
  const px = await s.eval(`(() => { const d = document.querySelector('#pad').getContext('2d').getImageData(160, 160, 1, 1).data; return [...d]; })()`);
  ok(px[0] > 240 && px[1] > 240, `${tag} undo removes the last stroke`, JSON.stringify(px));
  await shot('5-draw'); 
  await click('#draw-done'); await sleep(1300);

  // turn 2: guess
  ok((await s.eval(`document.querySelector('#pass-name').textContent`)) === 'Hafiz', `${tag} third player is Hafiz`);
  await click('#pass-go'); await sleep(500);
  ok(await visible() === 'guess', `${tag} guess screen`);
  ok(await s.eval(`document.querySelector('#guess-img').src.startsWith('data:image/png')`), `${tag} guesser sees the drawing`);
  const ir = JSON.parse(await s.eval(`JSON.stringify(document.querySelector('#guess-img').getBoundingClientRect())`));
  ok(ir.width >= 150 && ir.bottom <= dev.height, `${tag} drawing fits on the guess screen`, `${Math.round(ir.width)}px`);
  await s.eval(`document.querySelector('#guess-form').requestSubmit()`); await sleep(200);
  ok(await visible() === 'guess', `${tag} empty guess is refused`);
  await s.eval(`document.querySelector('#guess-input').value = 'Fish on a scooter'`);
  await shot('6-guess');
  await s.eval(`document.querySelector('#guess-form').requestSubmit()`); await sleep(1300);

  // turn 3: draw again but let the timer run out (30s is too long; shorten it)
  ok((await s.eval(`document.querySelector('#pass-name').textContent`)) === 'Siti', `${tag} fourth player is Siti`);
  await s.eval(`game.drawSec = 2`);
  await click('#pass-go'); await sleep(600);
  await drawLine([P(.2, .5), P(.8, .5)]);
  await sleep(2600);
  ok(await visible() === 'reveal-intro', `${tag} time-up auto-submits the last turn`);
  await shot('7-reveal-intro');
  await click('#start-reveal'); await sleep(400);
  for (let i = 0; i < 3; i++) { await click('#reveal-next'); await sleep(350); }
  ok(await s.eval(`document.querySelectorAll('#feed .card').length`) === 4, `${tag} reveal shows all 4 turns`);
  ok(await s.eval(`!document.querySelector('#reveal-end').hidden`), `${tag} end summary appears`);
  ok((await s.eval(`document.querySelector('#from-to').textContent`)).includes('Fish on a scooter'), `${tag} summary compares start and end`);
  ok(await s.eval(`document.querySelectorAll('#feed .late').length`) === 1, `${tag} late turn is flagged`);
  await click('#feed .card:nth-child(2) .crown'); await sleep(200);
  await noHScroll('reveal');
  await shot('8-reveal-end');
  await s.eval(`document.querySelector('#feed').scrollIntoView()`);
  await s.eval(`document.querySelector('#reveal').scrollTop = 0`); await sleep(300);
  await shot('8b-reveal-top');
  const size = await s.eval(`buildChainImage().then(b => new Promise(res => { const img = new Image(); img.onload = () => res([b.size, img.width, img.height]); img.src = URL.createObjectURL(b); }))`);
  ok(size[0] > 20000 && size[1] === 1080, `${tag} chain image builds`, `${size[1]}x${size[2]}, ${Math.round(size[0] / 1024)} KB`);
  if (dev.name === 'phone') {
    const b64 = await s.eval(`buildChainImage().then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(b); }))`);
    fs.writeFileSync(`${dir}/chain-export.png`, Buffer.from(b64, 'base64'));
  }
  await click('#play-again'); await sleep(300);
  ok((await s.eval(`game.players[0]`)) === 'Aina', `${tag} play again rotates the starter`);

  const errs = s.events.filter(e => (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') || e.method === 'Runtime.exceptionThrown');
  ok(errs.length === 0, `${tag} no console errors`, errs.map(e => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  await s.close();
}

(async () => {
  fs.mkdirSync(`${__dirname}/shots`, { recursive: true });
  await launch();
  for (const d of DEVICES) await play(d);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
