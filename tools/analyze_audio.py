"""分析 audio-protocol/ 的地墊音檔，產生 audio-protocol/protocol.json 給 js/audio-control.js 使用。

  button-0N.wav  踩 N 號格子的聲音，各有一個專屬超聲波頻率（5 號是休息區，沒有音檔）
  environment.wav  一般環境背景音，用來估計各頻帶的噪音基準

算法與瀏覽器 AnalyserNode 一致（Blackman 窗、|X|/N、20·log10）。
這裡的頻率只是「預設值」：實際頻率、訊號強度與閾值以遊戲內「收音設定與校正」的現場量測為準
（10 秒背景校正 ＋ 逐格踩踏檢查，規則見 js/audio-core.js，依 motionpad-audio-receiver）。
用法：python tools/analyze_audio.py
"""
import json, re, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "audio-protocol"
FFT = 4096            # 與 audio-control.js 的 analyser.fftSize 相同
BAND_HZ = 40          # 半頻寬，與 motionpad 接收器預設相同
SEARCH_FROM = 15000   # 只在這個頻率以上找專屬頻率


def load(path):
    w = wave.open(str(path))
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels())
    return x.mean(1) / 32768.0, w.getframerate()


def frames_db(x):
    win = np.blackman(FFT)
    hop = FFT // 2
    fr = np.array([x[i:i + FFT] * win for i in range(0, len(x) - FFT, hop)])
    mag = np.abs(np.fft.rfft(fr, axis=1)) / FFT
    return 20 * np.log10(mag + 1e-12)


def band_db(db, freqs, f):
    sel = (freqs >= f - BAND_HZ) & (freqs <= f + BAND_HZ)
    return db[:, sel].max(1)


def main():
    env, sr = load(DIR / "environment.wav")
    freqs = np.fft.rfftfreq(FFT, 1 / sr)
    env_db = frames_db(env)
    env_mean = env_db.mean(0)

    keys = {str(k): None for k in range(1, 10)}
    tone_db, noise_db = {}, {}
    for f in sorted(DIR.glob("button-*.wav")):
        k = str(int(re.search(r"(\d+)", f.stem).group(1)))
        x, sr2 = load(f)
        assert sr2 == sr, f"{f.name}: 取樣率 {sr2} ≠ {sr}"
        db = frames_db(x)
        hi = freqs >= SEARCH_FROM
        # 峰值相對環境音最突出的頻率 = 專屬頻率，取整到 10 Hz
        snr = db.max(0) - env_mean
        i = np.where(hi)[0][np.argmax(snr[hi])]
        hz = int(round(freqs[i] / 10) * 10)
        keys[k] = hz
        tone_db[k] = round(float(np.median(band_db(db, freqs, hz))), 1)
        noise_db[k] = round(float(np.percentile(band_db(env_db, freqs, hz), 95)), 1)

    proto = {
        "version": 1,
        "note": "九宮格地墊超聲波參考頻率（由參考音檔分析，僅作預設值）；5 號為休息區，沒有頻道。實際頻率與閾值以遊戲內校正為準。",
        "sampleRate": sr,
        "fftSize": FFT,
        "bandHz": BAND_HZ,
        "keys": keys,
        "noiseFloorDb": noise_db,
        "toneDb": tone_db,
    }
    out = DIR / "protocol.json"
    out.write_text(json.dumps(proto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for k in sorted(noise_db, key=int):
        print(f"  {k}: {keys[k]:>5} Hz  tone {tone_db[k]:6.1f} dB  noise {noise_db[k]:6.1f} dB  SNR {tone_db[k] - noise_db[k]:5.1f}")
    print("->", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
