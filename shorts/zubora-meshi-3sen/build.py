#!/usr/bin/env python3
"""「下ごしらえ不要！ズボラ飯3選」制作スクリプト

    python3 build.py readings   # 読み上げの読みを確認（誤読チェック）
    python3 build.py audio      # 1行ずつ音声を作り、実際の長さからタイムラインを作る
    python3 build.py frames     # コードで描いた画像＋字幕のフレームを書き出す
    python3 build.py video      # タイムラインどおりに切り替えた mp4 を作る
    python3 build.py qa         # 書き出した動画を検査（間・同期・切り替え・はみ出し）
    python3 build.py script     # 台本全文 SCRIPT.md を書き出す
    python3 build.py all        # 上を全部

台本は script.json だけを直せば、音声の長さに合わせて切り替え時間も自動で付け直されます。
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
AUDIO_DIR = ROOT / "audio"
FRAMES_DIR = ROOT / "frames"
SCRIPT = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
FPS = SCRIPT["format"]["fps"]
SR = 48000
SAMPLES_PER_FRAME = SR // FPS
VIDEO = OUT / "zubora-meshi-3sen.mp4"
ROLE_JA = {"name": "名前", "blue": "青コメント", "pink": "ピンクコメント"}


def all_lines():
    """(section, line_index, line, cue_id) を台本順に返す"""
    for sec in SCRIPT["sections"]:
        for i, line in enumerate(sec["lines"]):
            yield sec, i, line, f"{sec['id']}_{i + 1}_{line['role']}"


def run(cmd, **kw):
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


def read_wav(path):
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768


def write_wav(path, x):
    y = np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def rms_env(x, hop=0.01):
    h = int(SR * hop)
    n = len(x) // h
    return np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1) + 1e-12)


def speech_segments(x, thr_db=-38, min_gap=0.12, hop=0.01):
    """声のある区間 [(start, end), ...] 秒。短い無音（文中の息継ぎ）はつなげる"""
    env = 20 * np.log10(rms_env(x, hop))
    on = env > thr_db
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            segs.append([start * hop, i * hop])
            start = None
    if start is not None:
        segs.append([start * hop, len(on) * hop])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged


# ---------------------------------------------------------------- 読みの確認

def jtalk(text, wav_path=None, override=None):
    """Open JTalk で合成し、解析トレース（読み・アクセント）を返す。
    override: 行ごとの声の調整（例 {"speed": 1.0}）。script.json の各行に "voice" で書ける"""
    v = {**SCRIPT["voice"], **(override or {})}
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "in.txt").write_text(text + "\n", encoding="utf-8")
        run(["open_jtalk", "-x", v["dic"], "-m", ROOT / v["htsvoice"],
             "-r", v["speed"], "-fm", v["half_tone"],
             "-jf", v["gv_weight_f0"], "-jm", v["gv_weight_spectrum"],
             "-ow", wav_path or td / "o.wav", "-ot", td / "t.txt", td / "in.txt"])
        return (td / "t.txt").read_text(encoding="utf-8", errors="replace")


def reading_of(text):
    """Open JTalk が実際に読む読み（語ごと）"""
    block = jtalk(text).split("[Text analysis result]")[1].split("[Output label]")[0]
    words = []
    for row in block.strip().splitlines():
        f = row.split(",")
        if len(f) > 9 and f[1] != "記号":
            words.append((f[0], f[9].replace("’", "")))
    return words


def normalize_kana(s):
    return re.sub(r"[\s、。！？!?’・]", "", s)


def cmd_readings():
    OUT.mkdir(exist_ok=True)
    if SCRIPT["voice"]["engine"] == "files":
        print("voice.engine が files（録音ファイルを使う）なので、Open JTalk の読み確認は省略します")
        return
    if not (ROOT / SCRIPT["voice"]["htsvoice"]).exists():
        sys.exit("音声モデルがありません。先に ./fetch_assets.sh を実行してください")
    rows, bad = [], 0
    for sec, i, line, cue in all_lines():
        words = reading_of(line["say"])
        got = "".join(p for _, p in words)
        exp = line.get("expect")
        ok = exp is not None and normalize_kana(exp) == normalize_kana(got)
        bad += 0 if ok else 1
        mark = "未登録" if exp is None else ("OK" if ok else "NG")
        rows.append(f"{cue}\t{mark}\t{line['say']}\t{got}\t{' '.join(w + '/' + p for w, p in words)}")
        print(f"[{mark}] {cue}: {line['say']}\n       → {got}")
    (OUT / "readings.tsv").write_text("cue\t判定\t読み上げ文\t実際の読み\t語ごと\n" + "\n".join(rows) + "\n",
                                      encoding="utf-8")
    if bad:
        sys.exit(f"読みが確認済みの読み(expect)と違う、または未登録の行が {bad} 行あります")


# ---------------------------------------------------------------- 音声とタイムライン

def synth(line, cue):
    """1行を合成 → ゆっくり風に帯域を狭める → 前後の無音をそろえる。
    voice.engine が "files" のときは voice_in/<cue>.wav（ゆっくりMovieMaker 等で書き出した録音）を使う"""
    v = SCRIPT["voice"]
    with tempfile.TemporaryDirectory() as td:
        raw, lofi = Path(td) / "raw.wav", Path(td) / "lofi.wav"
        if v["engine"] == "files":
            raw = ROOT / v.get("files_dir", "voice_in") / f"{cue}.wav"
            if not raw.exists():
                sys.exit(f"{raw.relative_to(ROOT)} がありません（1行ずつ <cue>.wav で置いてください）")
            af = "anull"
        else:
            jtalk(line["say"], wav_path=raw, override=line.get("voice"))
            af = f"aresample={v['lofi_rate']},aresample={SR}" if v.get("lofi_rate") else "anull"
        run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ar", SR, "-ac", 1,
             "-c:a", "pcm_s16le", lofi])
        x = read_wav(lofi)
    segs = speech_segments(x, thr_db=-50)
    s, e = segs[0][0], segs[-1][1]
    a = max(0, int((s - v["head_pad"]) * SR))
    b = min(len(x), int((e + v["tail_pad"]) * SR))
    y = x[a:b].copy()
    fade = int(0.006 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    write_wav(AUDIO_DIR / f"{cue}.wav", y)
    return len(y) / SR


def loudness(path):
    """(integrated LUFS, true peak dBTP)"""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    m = json.loads(p.stderr[p.stderr.rindex("{"):])
    return float(m["input_i"]), float(m["input_tp"])


def gain_and_limit(src, dst, gain_db, limit_db=-2.0):
    """一定のゲインで持ち上げ、はみ出すピークだけをリミッターで抑える（声の音量は揺らさない）"""
    af = f"volume={gain_db:.2f}dB,alimiter=limit={10 ** (limit_db / 20):.4f}:attack=3:release=60:level=0:latency=1"
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af, "-ar", SR, "-ac", 1, "-c:a", "pcm_s16le", dst])


def cmd_audio():
    AUDIO_DIR.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    tm = SCRIPT["timing"]
    items = list(all_lines())
    cues, t = [], tm["lead_in"]
    for k, (sec, i, line, cue) in enumerate(items):
        dur = synth(line, cue)
        start_f = round(t * FPS)               # 切り替えはフレーム境界にそろえ、声もその位置に置く
        cues.append({"cue": cue, "section": sec["id"], "label": sec["label"], "role": line["role"],
                     "text": line["text"], "caption": line.get("caption", line["text"]),
                     "image": line["image"], "audio": f"audio/{cue}.wav",
                     "audio_sec": round(dur, 3), "start_frame": start_f})
        last_in_section = i == len(sec["lines"]) - 1
        t = start_f / FPS + dur + (tm["gap_section"] if last_in_section else tm["gap_line"])
    speech_end = cues[-1]["start_frame"] / FPS + cues[-1]["audio_sec"]
    total_frames = round((speech_end + tm["tail"]) * FPS)
    for k, c in enumerate(cues):
        c["visual_start_frame"] = 0 if k == 0 else c["start_frame"]
        c["end_frame"] = cues[k + 1]["start_frame"] if k + 1 < len(cues) else total_frames
        c["start"] = round(c["start_frame"] / FPS, 3)
        c["end"] = round(c["end_frame"] / FPS, 3)
        c["speech_end"] = round(c["start"] + c["audio_sec"], 3)

    # ナレーションを1本にまとめる（各行は start_frame の位置にぴったり置く）
    def assemble():
        narr = np.zeros(total_frames * SAMPLES_PER_FRAME)
        for c in cues:
            x = read_wav(ROOT / c["audio"])
            a = c["start_frame"] * SAMPLES_PER_FRAME
            narr[a:a + len(x)] += x
        write_wav(OUT / "narration.wav", narr)

    # 音量: 全体の実測から一定のゲインを決め、各行のファイルに同じ処理をかけてから組み直す
    target = -16.0
    assemble()
    input_i, _ = loudness(OUT / "narration.wav")
    with tempfile.TemporaryDirectory() as td:
        for c in cues:
            tmp = Path(td) / "c.wav"
            gain_and_limit(ROOT / c["audio"], tmp, target - input_i)
            write_wav(ROOT / c["audio"], read_wav(tmp)[: round(c["audio_sec"] * SR)])
    assemble()
    out_i, out_tp = loudness(OUT / "narration.wav")

    tl = {"fps": FPS, "total_frames": total_frames, "duration": round(total_frames / FPS, 3),
          "loudness": {"input_i": input_i, "gain_db": round(target - input_i, 2),
                       "output_i": out_i, "output_tp": out_tp, "normalization": "linear gain + peak limiter"},
          "cues": cues}
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    write_timeline_csv(tl)
    write_srt(tl)
    cmd_script()
    print(f"音声 {len(cues)} 行、全体 {tl['duration']:.2f} 秒（{total_frames} フレーム）"
          f" / ラウドネス {out_i} LUFS, TP {out_tp} dBTP")


def fmt_srt(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(tl):
    rows = []
    for n, c in enumerate(tl["cues"], 1):
        end = min(c["end"], c["speech_end"] + 0.3)
        rows.append(f"{n}\n{fmt_srt(c['start'])} --> {fmt_srt(end)}\n{c['caption']}\n")
    (OUT / "captions.srt").write_text("\n".join(rows), encoding="utf-8")


def write_timeline_csv(tl):
    head = "cue,項目,役割,切り替え開始(秒),切り替え終了(秒),開始フレーム,終了フレーム,声の長さ(秒),声の終わり(秒),画像,音声ファイル,字幕"
    rows = [head]
    for c in tl["cues"]:
        text = c["text"].replace("\n", " ")
        rows.append(f"{c['cue']},{c['label']},{ROLE_JA[c['role']]},{c['start']:.2f},{c['end']:.2f},"
                    f"{c['visual_start_frame']},{c['end_frame']},{c['audio_sec']:.2f},{c['speech_end']:.2f},"
                    f"{c['image']},{c['audio']},\"{text}\"")
    (OUT / "timeline.csv").write_text("\n".join(rows) + "\n", encoding="utf-8-sig")


# ---------------------------------------------------------------- 台本全文

def cmd_script():
    tl_path = OUT / "timeline.json"
    times = {}
    if tl_path.exists():
        times = {c["cue"]: c for c in json.loads(tl_path.read_text(encoding="utf-8"))["cues"]}
    md = [f"# 台本全文：{SCRIPT['title']}", "",
          f"> {SCRIPT['structure_note']}", "",
          "秒数は実際の音声の長さから自動で付けた切り替え時刻です（`python3 build.py audio` で更新）。", ""]
    for n, sec in enumerate(SCRIPT["sections"], 1):
        md += [f"## 項目{n}　{sec['label']}：{sec['name'].replace(chr(10), '')}", ""]
        if sec.get("item"):
            for k, v in sec["item"].items():
                md.append(f"- **{k}**：{v}")
            md.append("")
        md += ["| 時刻(秒) | 種類 | 画面の文字 | 読み上げ | 確認済みの読み | 画像 |", "|---|---|---|---|---|---|"]
        for i, line in enumerate(sec["lines"]):
            cue = f"{sec['id']}_{i + 1}_{line['role']}"
            c = times.get(cue)
            tt = f"{c['start']:.2f}–{c['end']:.2f}" if c else "—"
            md.append(f"| {tt} | {ROLE_JA[line['role']]} | {line['text'].replace(chr(10), '<br>')} | "
                      f"{line['say']} | {line.get('expect', '')} | `{line['image']}` |")
        md.append("")
        if sec.get("official"):
            md.append("**公式情報での確認**")
            md.append("")
            for o in sec["official"]:
                md.append(f"- {o['確認したこと']}（[{o['出典']}]({o['url']})）")
            md.append("")
    (ROOT / "SCRIPT.md").write_text("\n".join(md), encoding="utf-8")


# ---------------------------------------------------------------- フレーム

def cue_states():
    states = []
    for sec, i, line, cue in all_lines():
        by_role = {l["role"]: l["text"] for l in sec["lines"]}
        roles_so_far = [l["role"] for l in sec["lines"][: i + 1]]
        states.append({"cue": cue, "label": sec["label"], "number": sec["number"], "name": sec["name"],
                       "image": line["image"], "active": line["role"],
                       "blue": by_role.get("blue") if "blue" in roles_so_far else None,
                       "pink": by_role.get("pink") if "pink" in roles_so_far else None})
    return states


def cmd_frames():
    FRAMES_DIR.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    (OUT / "cues.json").write_text(json.dumps(cue_states(), ensure_ascii=False, indent=1), encoding="utf-8")
    npm_root = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True, check=True).stdout.strip()
    env = {**os.environ, "NODE_PATH": npm_root}
    run(["node", ROOT / "render_frames.js", OUT / "cues.json", FRAMES_DIR, OUT / "layout_check.json"], env=env)
    sheet = contact_sheet([FRAMES_DIR / f"{c['cue']}.png" for c in cue_states()], cols=5)
    sheet.save(OUT / "frames_contact.png")


def contact_sheet(paths, cols=5, w=270):
    ims = [Image.open(p).convert("RGB") for p in paths]
    h = round(w * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * 8, rows * h + (rows + 1) * 8), "#222")
    for k, im in enumerate(ims):
        sheet.paste(im.resize((w, h), Image.LANCZOS), (8 + (k % cols) * (w + 8), 8 + (k // cols) * (h + 8)))
    return sheet


# ---------------------------------------------------------------- 動画

def cmd_video():
    tl = json.loads((OUT / "timeline.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as td:
        n = 0
        for c in tl["cues"]:
            src = FRAMES_DIR / f"{c['cue']}.png"
            for _ in range(c["visual_start_frame"], c["end_frame"]):
                os.symlink(src, Path(td) / f"{n:05d}.png")
                n += 1
        assert n == tl["total_frames"], (n, tl["total_frames"])
        run(["ffmpeg", "-v", "error", "-y", "-framerate", FPS, "-i", Path(td) / "%05d.png",
             "-i", OUT / "narration.wav", "-map", "0:v", "-map", "1:a",
             "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
             "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-tune", "stillimage",
             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-r", FPS, "-c:a", "aac", "-b:a", "192k", "-ar", SR,
             "-t", f"{tl['total_frames'] / FPS:.6f}", "-movflags", "+faststart", VIDEO])
    print(f"書き出し: {VIDEO.relative_to(ROOT)} ({VIDEO.stat().st_size / 1e6:.1f} MB)")


# ---------------------------------------------------------------- 検査

def probe(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                       capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def extract_frames(indices, size=(270, 480)):
    """mp4 から指定フレームを取り出す（フレーム番号どおりの位置か確かめるため）"""
    sel = "+".join(f"eq(n\\,{i})" for i in indices)
    with tempfile.TemporaryDirectory() as td:
        run(["ffmpeg", "-v", "error", "-i", VIDEO, "-vf", f"select='{sel}',scale={size[0]}:{size[1]}",
             "-vsync", "0", Path(td) / "f%03d.png"])
        files = sorted(Path(td).glob("f*.png"))
        return [np.asarray(Image.open(f).convert("RGB"), dtype=np.float64) for f in files]


def lev(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[len(b)]


# 音声認識が漢字で返した語を、こちらの読み解析が誤読しないように直す（数え方など）
HEARD_FIX = {"一品目": "いっぴんめ", "二品目": "にひんめ", "三品目": "さんぴんめ", "三品": "さんぴん", "釜玉": "かまたま"}


def cmd_hear():
    """書き出した動画の音声を日本語音声認識にかけ、台本どおりに聞こえるかを確かめる（任意の検査）。
    モデル: sherpa-onnx の ReazonSpeech（https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models の
    sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01）。展開先を環境変数 ASR_MODEL_DIR で指定"""
    model = Path(os.environ.get("ASR_MODEL_DIR", ROOT / "assets" / "asr"))
    try:
        import sherpa_onnx
    except ImportError:
        print("sherpa-onnx が無いので聞き取り検査は省略（pip install sherpa-onnx）")
        return
    if not (model / "tokens.txt").exists():
        print(f"音声認識モデルが {model} に無いので聞き取り検査は省略")
        return
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(model / "encoder-epoch-99-avg-1.int8.onnx"), decoder=str(model / "decoder-epoch-99-avg-1.int8.onnx"),
        joiner=str(model / "joiner-epoch-99-avg-1.int8.onnx"), tokens=str(model / "tokens.txt"), num_threads=4)
    tl = json.loads((OUT / "timeline.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as td:
        run(["ffmpeg", "-v", "error", "-i", VIDEO, "-vn", "-ac", 1, "-ar", 16000, "-c:a", "pcm_s16le", Path(td) / "a.wav"])
        with wave.open(str(Path(td) / "a.wav")) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    lines = {cue: line for _, _, line, cue in all_lines()}
    rows = []
    for c in tl["cues"]:
        a, b = int(max(0, c["start"] - 0.25) * 16000), int(min(c["end"], c["speech_end"] + 0.25) * 16000)
        seg = np.concatenate([np.zeros(8000, np.float32), x[a:b], np.zeros(8000, np.float32)])
        s = rec.create_stream()
        s.accept_waveform(16000, seg)
        rec.decode_stream(s)
        heard = s.result.text.strip()
        fixed = heard
        for k, v in HEARD_FIX.items():
            fixed = fixed.replace(k, v)
        got = normalize_kana("".join(p for _, p in reading_of(fixed))) if fixed else ""
        exp = normalize_kana(lines[c["cue"]]["expect"])
        rows.append({"cue": c["cue"], "say": lines[c["cue"]]["say"], "heard": heard,
                     "match": round(1 - lev(got, exp) / max(1, len(exp)), 2)})
    (OUT / "hearing.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in rows:
        print(f"{r['match']:.2f}  {r['cue']}: {r['say']}  →  {r['heard']}")


def cmd_qa():
    tl = json.loads((OUT / "timeline.json").read_text(encoding="utf-8"))
    cues = tl["cues"]
    report, problems = [f"# 検査レポート：{SCRIPT['title']}", ""], []

    # 1) 形式
    info = probe(VIDEO)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    dur = float(info["format"]["duration"])
    report += ["## 1. 書き出し形式", "",
               f"- 映像: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} fps, {v['nb_frames']} フレーム",
               f"- 音声: {a['codec_name']} {a['sample_rate']} Hz",
               f"- 長さ: {dur:.2f} 秒（タイムライン {tl['duration']:.2f} 秒）",
               f"- ラウドネス: {tl['loudness']['output_i']} LUFS / TP {tl['loudness']['output_tp']} dBTP", ""]
    if (v["width"], v["height"]) != (1080, 1920) or int(v["nb_frames"]) != tl["total_frames"]:
        problems.append("解像度またはフレーム数がタイムラインと違う")

    # 2) 読み間違い（読みの確認結果）
    report += ["## 2. 読み間違い", ""]
    if SCRIPT["voice"]["engine"] == "files":
        report.append("- 録音ファイルを使っているので Open JTalk の読み確認は対象外（下の聞き取り検査で確認）")
    else:
        quiet = subprocess.run([sys.executable, str(ROOT / "build.py"), "readings"], capture_output=True, text=True)
        n_ok = quiet.stdout.count("[OK]")
        report.append(f"- Open JTalk の解析結果で、全 {len(cues)} 行中 {n_ok} 行が確認済みの読みと一致（詳細: `out/readings.tsv`）")
        if n_ok != len(cues):
            problems.append("読みが一致しない行がある")
    hearing = OUT / "hearing.json"
    if hearing.exists() and hearing.stat().st_mtime >= VIDEO.stat().st_mtime:
        rows = json.loads(hearing.read_text(encoding="utf-8"))
        report += ["- 動画の音声を日本語音声認識（ReazonSpeech）で聞き取らせ、かな読みで台本と照合（`python3 build.py hear`）", "",
                   "| cue | 台本の読み上げ | 聞き取り結果 | 読みの一致率 |", "|---|---|---|---|"]
        report += [f"| {r['cue']} | {r['say']} | {r['heard']} | {r['match']:.0%} |" for r in rows]
        low = [r for r in rows if r["match"] < 0.85]
        report += ["", f"- 一致率 85% 未満: {len(low)} 行" + "".join(f"（{r['cue']}）" for r in low)]
        problems += [f"{r['cue']}: 聞き取り結果が台本と違う（{r['heard']}）" for r in low]
    else:
        report += ["- 音声認識による聞き取り検査は未実施（`python3 build.py hear`）"]
    report.append("")

    # 3) 字幕のはみ出し（描画時の実測）
    lay = json.loads((OUT / "layout_check.json").read_text(encoding="utf-8"))
    over = [f"{r['cue']}: {r['what']}" for r in lay if not r["ok"]]
    report += ["## 3. 字幕・文字のはみ出し", "",
               f"- 全フレームの文字要素 {len(lay)} 個を実測、はみ出し {len(over)} 件"
               + ("" if not over else "：" + "、".join(over)),
               "- 字幕の文字幅は横 943px 以内（YouTube ショートの右側ボタンにかからない範囲）", ""]
    problems += over

    # 4) 切り替えのタイミング（動画から実フレームを取り出して確認）
    exp_imgs = {c["cue"]: np.asarray(Image.open(FRAMES_DIR / f"{c['cue']}.png").convert("RGB")
                                     .resize((270, 480), Image.LANCZOS), dtype=np.float64) for c in cues}
    idx = []
    for c in cues[1:]:
        idx += [c["start_frame"] - 1, c["start_frame"]]
    got = extract_frames(idx)
    sw_rows = []
    for k, c in enumerate(cues[1:]):
        before, after = got[2 * k], got[2 * k + 1]
        prev = cues[k]["cue"]
        ok = (np.abs(before - exp_imgs[prev]).mean() < np.abs(before - exp_imgs[c["cue"]]).mean()
              and np.abs(after - exp_imgs[c["cue"]]).mean() < np.abs(after - exp_imgs[prev]).mean())
        sw_rows.append(f"| {c['start']:.2f} | {c['start_frame']} | {c['cue']} | {'OK' if ok else 'NG'} |")
        if not ok:
            problems.append(f"{c['cue']} の切り替えフレームがずれている")
    report += ["## 4. 画像・字幕の切り替え（動画の実フレームで確認）", "",
               "| 切り替え(秒) | フレーム | 切り替わる先 | 判定 |", "|---|---|---|---|"] + sw_rows + [""]

    # 5) 声と切り替えの同期・不自然な間（動画の音声トラックを解析）
    with tempfile.TemporaryDirectory() as td:
        run(["ffmpeg", "-v", "error", "-i", VIDEO, "-vn", "-ac", 1, "-ar", SR, "-c:a", "pcm_s16le",
             Path(td) / "a.wav"])
        x = read_wav(Path(td) / "a.wav")
    segs = speech_segments(x, thr_db=-42, min_gap=0.15)
    sync_rows = []
    for c in cues:
        inside = [s for s in segs if s[1] > c["start"] and s[0] < c["end"]]
        onset = inside[0][0] if inside else None
        end = inside[-1][1] if inside else None
        lead = None if onset is None else onset - c["start"]
        ok = onset is not None and -0.02 <= lead <= 0.15 and end <= c["end"] + 0.02
        sync_rows.append(f"| {c['cue']} | {c['start']:.2f} | {onset if onset is None else f'{onset:.2f}'} | "
                         f"{end if end is None else f'{end:.2f}'} | {c['end']:.2f} | {'OK' if ok else 'NG'} |")
        if not ok:
            problems.append(f"{c['cue']}: 声と切り替えがずれている（声 {onset}〜{end} / 画面 {c['start']}〜{c['end']}）")
    gaps = [(segs[k][1], segs[k + 1][0]) for k in range(len(segs) - 1)]
    long_gaps = [g for g in gaps if g[1] - g[0] > 0.9]

    def kind(g):  # 無音の種類: 文中（読点など）／同じ項目の行と行の間／項目の切れ目
        mid = (g[0] + g[1]) / 2
        k = next(i for i, c in enumerate(cues) if c["start"] <= mid < c["end"])
        if mid < cues[k]["speech_end"]:
            return "文中の区切り"
        return "項目の切れ目" if k + 1 < len(cues) and cues[k + 1]["section"] != cues[k]["section"] else "行と行の間"
    by_kind = {}
    for g in gaps:
        by_kind.setdefault(kind(g), []).append(g[1] - g[0])
    pause_rows = [f"| {k} | {len(v)} | {min(v):.2f} | {max(v):.2f} |" for k, v in by_kind.items()]
    report += ["## 5. 声と切り替えの同期", "",
               "字幕は声の少し前（0〜0.15秒）に出し、次の切り替えまでに声が終わっていれば OK。", "",
               "| cue | 画面切替(秒) | 声の始まり | 声の終わり | 次の切替 | 判定 |", "|---|---|---|---|---|---|"]
    report += sync_rows + ["", "## 6. 間（ま）", "",
                           "| 無音の種類 | 数 | 最短(秒) | 最長(秒) |", "|---|---|---|---|"] + pause_rows + ["",
                           f"- 0.9 秒を超える無音: {len(long_gaps)} か所"
                           + "".join(f"（{g[0]:.2f}〜{g[1]:.2f}秒）" for g in long_gaps),
                           f"- 冒頭の無音 {segs[0][0]:.2f} 秒 / 最後の声のあと {dur - segs[-1][1]:.2f} 秒（締めの余韻）", ""]
    problems += [f"長すぎる無音 {g[0]:.2f}〜{g[1]:.2f}秒" for g in long_gaps]

    # 7) 確認用の書き出し（各カットの中央フレーム）
    mids = [(c["visual_start_frame"] + c["end_frame"]) // 2 for c in cues]
    imgs = extract_frames(mids, size=(540, 960))
    with tempfile.TemporaryDirectory() as td:
        paths = []
        for k, im in enumerate(imgs):
            p = Path(td) / f"m{k:02d}.png"
            Image.fromarray(im.astype(np.uint8)).save(p)
            paths.append(p)
        contact_sheet(paths, cols=5, w=270).save(OUT / "video_contact.png")
    report += ["## 7. 目視確認用", "", "- `out/video_contact.png`：動画から各カットの中央フレームを取り出して並べたもの", ""]

    report += ["## 結果", "", "問題なし" if not problems else "\n".join(f"- {p}" for p in problems), ""]
    (OUT / "qa_report.md").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    if problems:
        sys.exit(f"検査で {len(problems)} 件の問題")


COMMANDS = {"readings": cmd_readings, "audio": cmd_audio, "frames": cmd_frames,
            "video": cmd_video, "hear": cmd_hear, "qa": cmd_qa, "script": cmd_script}

if __name__ == "__main__":
    steps = sys.argv[1:] or ["all"]
    if steps == ["all"]:
        steps = ["readings", "audio", "frames", "video", "hear", "qa"]
    for s in steps:
        COMMANDS[s]()
