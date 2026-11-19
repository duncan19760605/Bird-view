// 在遊戲頁面內執行（electron . --selftest）：以參考音檔模擬收音，走完 Setup 的完整流程並驗證偵測結果。
(async () => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(step); } return false; };
  const RX = await import('./js/audio-receiver.js');
  const log = [];
  try { localStorage.removeItem('birdview-audio-v2'); } catch {}

  // 1–3. 一鍵引導校正：開啟收音（測試輸入）→ 10 秒背景校正 → 逐格踩踏 → 自動套用（若改了頻率會自動重新背景校正）
  await until(() => $('btnCal') && document.querySelectorAll('.level-card').length, 5000);
  $('btnCal').click();
  await sleep(500);
  $('btnRxGuided').click();
  const calOk = await until(() => RX.calibrationValid(), 20000);
  log.push({ step: 'background', ok: calOk, msg: $('rxMsg').textContent });
  if (!calOk) return { ok: false, log };
  const bg = RX.getCalibration().means;
  const doneOk = await until(() => $('rxMsg').textContent.startsWith('完成') && !$('btnRxGuided').disabled, 120000, 200);
  const sug = [...document.querySelectorAll('#rxSummary tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' '));
  const calibrated = RX.getConfig().channels.filter((c) => c.thresholdMode !== 'global').length;
  log.push({ step: 'guided', ok: doneOk && calibrated === 8, calibrated, msg: $('rxMsg').textContent });
  if (!doneOk) return { ok: false, log, sug };
  await until(() => RX.calibrationValid(), 16000);
  const cfg = RX.getConfig();

  // 偵測器從 locked 開始，要先經過一次「放開」才待命（玩家站在 5 號休息區）
  let armed = false;
  const offArm = RX.on('frame', ({ rows }) => { armed = rows.every((r) => r.state === 'armed'); });
  const armedOk = await until(() => armed, 5000);
  offArm();
  log.push({ step: 'armed', ok: armedOk });

  // 4. 偵測測試：環境音循環中依序踩 8 格，每格應剛好觸發一次正確的位置
  const hits = [];
  const off = RX.on('input', (e) => hits.push(e.conflict ? { conflict: e.positions } : { position: e.position }));
  const results = {};
  for (const gainDb of [0, -10]) {
    for (const pos of [1, 2, 3, 4, 6, 7, 8, 9]) {
      hits.length = 0;
      await RX.playTestInput([{ url: `audio-protocol/button-0${pos}.wav`, gainDb, at: 0.1 }], { keep: true });
      await sleep(3900);
      results[`${pos}@${gainDb}dB`] = hits.map((h) => h.position ?? `conflict:${h.conflict}`).join(',') || '-';
    }
  }
  // 只有環境音 6 秒：不應觸發
  hits.length = 0;
  await sleep(6000);
  results['environment-only'] = hits.length ? hits.map((h) => h.position ?? 'conflict').join(',') : '-';
  off();

  const expect = (k) => results[k] === k.split('@')[0];
  const at0 = Object.keys(results).filter((k) => k.endsWith('@0dB'));
  const pass0 = at0.filter(expect).length;
  const passAtt = Object.keys(results).filter((k) => k.endsWith('@-10dB')).filter(expect).length;
  return {
    ok: calOk && doneOk && calibrated === 8 && pass0 === 8 && results['environment-only'] === '-',
    summary: { fullLevel: `${pass0}/8`, minus10dB: `${passAtt}/8`, falseTriggersOnBackground: results['environment-only'] },
    results,
    channels: cfg.channels.map((c) => ({
      position: c.position, frequency: c.frequency, mode: c.thresholdMode, multiplier: c.multiplier,
      backgroundDb: +(10 * Math.log10(bg[c.id])).toFixed(1),
    })),
    suggestions: sug,
    log,
  };
})();
