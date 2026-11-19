from pathlib import Path
import shutil,json,hashlib
R=Path(__file__).resolve().parent.parent; B=R/'MotionPad-STEM-Agent'
for d in ['skills/motionpad-stem','references','reference-runtime/js','reference-runtime/audio-protocol','examples/stem-observer','scripts','.github']: (B/d).mkdir(parents=True,exist_ok=True)
def write(name,text): (B/name).write_text(text.strip()+'\n',encoding='utf-8')
write('AGENTS.md','''# STEM game development agent — compatible with MotionPad

Read `skills/motionpad-stem/SKILL.md` and the relevant references before changing a game. Resolve every relative path from this bundle or the target project, never from a fixed drive letter. This document is provider-neutral; it does not depend on a particular AI model or tool API.

## Project contract
- Preserve the BirdView pattern: panorama + viewfinder, normalized coordinates, data-driven levels, one-target capture, collection and progress.
- Share one action boundary across keyboard, touch and microphone. 2/8/4/6 move; 7/1 zoom; 9 captures/confirms; 3 exits/cancels; 5 rests; exactly 1+7 switches equipment where supported. Every game screen needs a reachable exit or automatic completion.
- Reuse the receiver as a separate adapter. Read `references/hardware.md` when connecting a mat. Frequencies are calibratable defaults, not hardware guarantees. Do not invent BLE/serial, pressure, continuous motion or foot identity support.
- Keep microphone analysis disconnected from speakers. Filter game audio below ultrasonic control bands. Recalibrate on device/settings/background changes. Do not equate reference WAV tests with physical-device acceptance.
- Keep assets and recordings attributable. Never silently substitute a different species. Do not copy restricted external toolkits, signing keys or private agent conversations.
- Make the requested changes and run relevant checks. Record actual outcomes, incomplete items and field-test limits. Ask about missing requirements only when they materially affect the design.
- Multiple-agent work is optional and requires the user's or host's authorization. When authorized, divide file ownership and use `references/HANDOFF.md`; do not invent agent IDs or model histories.

## Useful entry points
- `references/architecture.md`: module boundaries and gameplay formulas.
- `references/hardware.md`: microphone, calibration, event routing and failure states.
- `references/prompts.md`: reusable bilingual build and art prompts.
- `reference-runtime/`: actual BirdView source snapshots; provenance hashes in `provenance.json`.
- `examples/stem-observer/`: runnable observation demo with keyboard/touch and guided mic calibration. Run `python scripts/serve.py`, then open the printed URL.
- `scripts/validate.py`: local bundle integrity and module-link checks.

This bundle guides new projects; do not modify the original BirdView or an external toolkit unless the user requests it. No publishing, messaging or signing is implied by reading this bundle.
''')
write('skills/motionpad-stem/SKILL.md','''---
name: motionpad-stem
description: Build or adapt STEM observation games using BirdView's panorama/viewfinder, data-driven targets, 3x3 keyboard/touch control, and microphone-based ultrasonic mat connection. Use for MotionPad-compatible STEM gameplay or receiver integration, not arbitrary serial/BLE devices.
---
# STEM observation games

Locate the target game and read its project instructions. Read the bundle's ../../AGENTS.md as the shared contract.

1. Inspect existing source, level data, asset ledger and actual device adapter. Write a short SPEC: topic, learner goal, action mapping, target/capture rules, completion, exit and fallback.
2. For camera/collection games read ../../references/architecture.md. Use normalized target coordinates and retain one-target capture. Change topic data before changing the engine.
3. For mat work read ../../references/hardware.md and the receiver snapshot. Validate actual sample rate, channel separation and calibration. Keep keyboard/touch usable when permission or hardware is absent.
4. Use ../../references/prompts.md only for prompts or asset work. Record source/license and transformations; no unlicensed toolkit copies.
5. Test the changed behavior, not only file existence: boundaries, capture categories, input combinations, stale async work, calibration loss and fallback. Reference audio simulation and field acceptance are separate outcomes.
6. Run `python scripts/validate.py` from the bundle root after changing the bundle. For BirdView's full source use its staging and Electron selftests. Record evidence and pending physical tests in a handoff.

Use ../../references/HANDOFF.md when another coding agent will continue. Platform adapters are entry instructions, not proof of automatic installation. No model-specific dependency is required.
''')
write('README.md','''# MotionPad-STEM-Agent

相容於 MotionPad 的 STEM 遊戲開發助手；非官方產品或硬體驗證。A portable STEM game development assistant compatible with MotionPad, without official endorsement or hardware certification.

## Start / 開始
1. Keep this folder together. Give your coding agent: “Read `<bundle>/AGENTS.md` and `<bundle>/skills/motionpad-stem/SKILL.md`, then build/adapt `<target>` according to `<requirements>`.”
2. Read architecture for gameplay and hardware for microphone connection. Source snapshots are self-contained and do not depend on the original drive path.
3. Run from this directory:
   ```sh
   python scripts/validate.py
   python scripts/serve.py
   ```
   Open http://localhost:8081/examples/stem-observer/ . Use keyboard/touch without a mat; use guided calibration for microphone input. This is a prototype, not physical hardware acceptance. LocalStorage progress/config is scoped to this server origin; avoid sharing ports with other games.

## Different coding agents / 多 AI 使用
- Codex or an agent that reads AGENTS.md: supply this folder as context; invoke the skill file explicitly if auto-discovery is unavailable.
- Claude Code: CLAUDE.md points to the common contract. Copy the bundle into a project or explicitly ask it to read that file.
- Gemini CLI: GEMINI.md provides the same entry point.
- GitHub Copilot: `.github/copilot-instructions.md` is provided for using this bundle as a project. When adding it to an existing repository, merge the reference into its existing instructions, do not overwrite them.
- DeepSeek Harness or other coding agents: paste the provider-neutral prompt in references/prompts.md; do not assume a proprietary preset schema is universal.
- Agent Skills hosts: install/copy `skills/motionpad-stem` WITH its referenced bundle layout, or retain the full bundle and read the skill by path. The relative references need their surrounding files. No global installation is performed by this delivery.

使用者明確要求多 agent 時才分工。Use multiple agents only when authorized. Record known tool/model names; use unknown for missing history.

## Contents and rights / 內容與權利
Reference runtime includes the project's input, camera, capture and microphone logic, plus its public protocol defaults. Provenance records original paths and hashes. No signing keys or restricted external toolkit files are included. See NOTICE.md. Existing workspace source has no blanket open-source license declared; obtain rights before redistributing the code. Open bird-call licenses are independent.

The demo has a small generated SVG world and no remote asset dependency. Keep production guided setup, permissions, failure handling and device validation when making a full game. Full BirdView testing commands are documented in references/architecture.md.
''')
for name in ['CLAUDE.md','GEMINI.md']:
 write(name,'# Agent entry point\n\nRead AGENTS.md and skills/motionpad-stem/SKILL.md in this folder. Use the shared contract, references and source snapshots. Follow the target project’s existing instructions. Run scripts/validate.py for bundle checks; report actual tests and hardware limitations. Do not claim platform installation or official certification.')
write('.github/copilot-instructions.md','# STEM coding instructions\n\nRead AGENTS.md from the bundle root and skills/motionpad-stem/SKILL.md. Keep keyboard/touch/microphone adapters separate from game rules. Preserve the 5-rest and 1+7 chord semantics. Record asset licenses and test evidence. If this bundle is nested, resolve the paths relative to its root, not the host repository.')
write('references/architecture.md','''# BirdView design reference

## Modules and data
The original is native JavaScript ES Modules with HTML/CSS and Canvas 2D. `main` orchestrates `camera`, `capture`, `presence`, `level`, `assets`, `render`, `progress`, `dex` and `ui`. Input uses `press` / `pressSwap`; the receiver exports typed events. Keep that boundary when replacing birds with stars, insects, marine animals or geometric targets.

Target schema: species ID, x/y normalized centers, scale as a scene-width fraction, art, flip and optional stay seconds. Capture uses box/view intersection. Exactly zero hits gives landscape, one hit gives collection, more than one fails (even identical species). Eligibility: 60% bird-box coverage OR center in view and 50% view coverage. These are gameplay approximations, not biological vision measurements.

`fov.w = (1/3)/zoom`, `fov.h = fov.w * sceneAspect`. At device minimum zoom, step = (1 − axisFov)/20; higher zoom, step = axisFov/3. Phone steps: 1,2,3,6 (optical max 3); scope: 10,15,20. Continuous increment: phone .25, scope .5. Clamp center to keep the view inside the scene.

`Presence`: a sufficiently enlarged eligible bird (`birdWidth/viewWidth >= .15`) starts its stay countdown; looking away does not pause it. It disappears, then returns after 15 seconds. Avoid claiming a synthetic timer is natural animal behavior.

Persistent progress includes per-level species, best optical/digital shot, landscapes, play dates and scope unlock. Distinguish species-count rewards from day-based unlocking. First-level five-species capture earns the scope.

## Development and acceptance
For the FULL BirdView project (not this small bundle):
```
python -m http.server 8080 --bind 127.0.0.1
python tools/check_level.py data/levels/level01.json
python tools/stage_web.py --with-test-audio
cd desktop
npm run selftest
.\\node_modules\\.bin\\electron.cmd . --selftest=soundscape
```
Before release restage without `--with-test-audio`. Electron uses staged `build/web`, not live root files. Android uses Capacitor's configured `webDir`, followed by sync and Gradle build/sign. Never package signing credentials into an agent bundle.

Verify capture zero/one/multiple, camera bounds, chord without preceding zoom, stop/mute/stale sound loads, input conflicts, invalid calibration, safe fallback and reachable exit. Existing EXE/APK versions remain unchanged until rebuilt. Run bundle `scripts/validate.py` independently.
''')
write('references/hardware.md','''# Microphone-based ultrasonic connection

This is the BirdView receiver path. An external toolkit host/bridge is a separate integration: use its legitimately obtained contract and never copy restricted mat/vendor or mat/profiles. Do not confuse BirdView's 20 ms reads with an external host's hop contract.

## Defaults and validation
Position → Hz: 1→18000, 2→18810, 3→19500, 4→20000, 5→null, 6→21000, 7→22990, 8→22000, 9→21500. Derived from reference WAVs, not universal device constants. Cell 5 is rest, not a ninth sensor. Validate unique positions, nonoverlapping bands and `frequency + bandwidth < actualSampleRate/2`. 44.1 kHz cannot capture cell 7 at this default.

Request mono 48 kHz with AGC/noise suppression/echo cancellation disabled. Check actual sample rate and errors. Microphone requires localhost/HTTPS or a secure app scheme and permission. `MediaStreamSource` connects only to an `AnalyserNode`, NEVER destination. Do not save raw microphone audio. Typed numerical CSV monitoring is distinct from audio recording.

FFT 4096; ±40 Hz; smoothing 0; 20 ms receiver loop. Band power is the linear mean of `10^(dB/10)` across eligible bins. NaN/+Infinity invalid; −Infinity contributes zero.

## Setup and failure lifecycle
Select device → start from user gesture → quiet/warm-up → 10-second time-weighted background calibration on cell 5 → measure cells 1,2,3,4,6,7,8,9 → suggestions based on signal/crosstalk/dips → apply successful cells, retry failed ones. Frequency changes require background recalibration.

Default threshold = background × 4 (linear power). Priority: manual threshold, custom multiplier, global multiplier. Default detector: locked → below T×.6 for 80ms → armed → above T for 40ms → trigger → locked. Held tones do not repeat. Multiple tones conflict; only exactly {1,7} maps to equipment switching. A 300 ms input chord cancels buffered zoom.

Receiver API: `init`, `start({deviceId})`, `waitQuiet`, `calibrate(progress)`, `measurePosition`, `suggest`, `updateConfig`, `calibrationValid`, `stop`; events `input`, `lost`, `frame`, `status`. Input contains position/conflict/positions. Route to `press` or `pressSwap` only when live, calibrated, and gameplay is accepting input.

Recalibrate before every level and after device/signature changes, imports, page hiding, device loss or sample gaps >250ms. Rejected permissions must leave keyboard/touch usable. Stop/cancel setup on exit; do not dispatch late events from an obsolete session.

Audio playback should be low-pass below the ultrasonic input bands. BirdView's new recordings are mono 32 kHz with cascaded 12 kHz low-pass, plus a playback 12 kHz filter. Verify speakers in the real room; filtering does not certify a zero-false-trigger system.

## What input cannot establish
No serial/BLE implementation, pressure, inside-cell position, foot identity or continuous sliding is present. Simulation (`?audiotest`, reference WAVs, fake keys) is not physical hardware measurement. Record actual device, sample rate, environment, distances, signal/crosstalk, misses/false triggers and failures for field acceptance.
''')
write('references/prompts.md','''# Reusable prompts — not fabricated historical transcripts

## Build / 建置
Read this bundle's AGENTS.md and skill. Build a [topic] STEM game using panorama + viewfinder, normalized targets, JSON levels, one-target capture and collection. Keep 5 rest, 2/8/4/6 movement, 7/1 zoom, 9 capture/confirm, 3 exit/cancel and 1+7 equipment switching. Use microphone-based ultrasonic input with real sample-rate validation and calibration; keyboard/touch must work without hardware. Deliver SPEC, source, licenses, test evidence and pending physical tests.

讀取本套件 AGENTS.md 與 skill，以 [主題] 製作 STEM 觀察遊戲：全景＋鏡頭、正規化目標、JSON 關卡、單一目標入鏡與圖鑑。保留九宮格操作與 5 休息、1＋7 切換；收音需校正與實際取樣率檢查，無設備時鍵盤／觸控可用。交付 SPEC、程式、素材授權與驗收證據。

## Assets / 素材
For a single target: preserve exact subject, pose, facing, proportions and identifying markings. Redraw as a warm children's colored-pencil illustration with gentle rounded forms. True transparent background; no extra targets, text, props or clipping. Scene: preserve composition and terrain coordinates, opaque edge-to-edge, no added animals. Record source, prompt, output, model/tool when known, and visual review; never label unknown authorship as known.

單一目標保留姿勢、方向、比例與辨識特徵，童書色鉛筆、溫暖圓潤、真透明、不加其他目標文字道具；場景保持構圖座標、滿版不透明、不新增動物。記錄來源、提示詞、輸出、已知模型／工具、視覺驗收。

BirdView's retained historical reusable prompt is in its assets/pencil-cartoon/GENERATION-PROMPTS.md. That file does not claim to preserve every early call.

## Authorized multi-agent work
Only when authorized: design owns SPEC, audio owns input contract/receiver, assets own manifest/rights, integration owns orchestration, verification owns evidence. Assign nonoverlapping files, integrate sequentially and use HANDOFF.md. Roles are a proposed workflow, not proof that any historical agent used a given model.
''')
write('references/HANDOFF.md','''# Agent handoff record
- Task and learner objective:
- Date / known agent ID / known tool and model (unknown if unavailable):
- Files owned and changed:
- Confirmed input and capture contract:
- Completed items with evidence:
- Asset sources / licenses / transformations / hashes:
- Commands run and actual result paths:
- Simulation results:
- Physical hardware measured (device, sample rate, environment) or UNTESTED:
- Pending items / BLOCKED reason / next action:
- Conflicts to resolve before integration:

Do not mark pending visuals or field tests PASS. Do not paste signing keys, private chats or restricted hardware profiles.
''')
write('NOTICE.md','''# Provenance and rights

The source snapshots are copied from this BirdView workspace, not from the restricted Genius Holdings creator toolkit. Their provenance hashes are recorded; workspace code has no blanket open-source license declared. This bundle does not grant third-party rights or make the whole project open source. Obtain rights before redistributing workspace code or art.

No external toolkit SKILL/reference/contract text, mat/vendor, mat/profiles, signing keys, model credentials or private chat logs are included. External host/bridge integration requires its own legitimately obtained tooling and license. “MotionPad” is used only to identify compatibility; the user-requested folder name is not a public product branding authorization.

The newly created demo uses generated geometric SVG shapes without external assets. Bird-call recordings remain in the main game, with their independent CC BY-SA credits and derivatives, not in this bundle. Source snapshots are a reference baseline, not automatically updated when BirdView changes; compare provenance and validate after deliberate updates.
''')
files=['config.js','device.js','camera.js','capture.js','input.js','audio-core.js','audio-receiver.js','audio-setup.js']
prov=[]
for name in files:
 src=R/'js'/name;dst=B/'reference-runtime/js'/name;shutil.copy2(src,dst);prov.append(dict(source='js/'+name,path='reference-runtime/js/'+name,sha256=hashlib.sha256(dst.read_bytes()).hexdigest()))
src=R/'audio-protocol/protocol.json';dst=B/'reference-runtime/audio-protocol/protocol.json';shutil.copy2(src,dst);prov.append(dict(source='audio-protocol/protocol.json',path='reference-runtime/audio-protocol/protocol.json',sha256=hashlib.sha256(dst.read_bytes()).hexdigest()))
(B/'provenance.json').write_text(json.dumps(dict(date='2026-10-11',origin='BirdView workspace; not restricted external toolkit',files=prov),indent=2)+'\n',encoding='utf-8')
print('Agent instructions and source snapshots created')
