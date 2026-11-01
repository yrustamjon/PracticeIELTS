import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Rewind,
  FastForward,
} from "lucide-react";
import { useAuth } from "../stores/auth";
import { post, restore } from "../services/api";
export function AudioPlayer({
  url,
  start = 0,
  end,
  onTime,
  playRequest,
}: {
  url: string;
  start?: number;
  end?: number;
  onTime?: (ms: number) => void;
  playRequest?: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(start / 1000);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [volume, setVolume] = useState(1);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const endTime = end === undefined ? duration : end / 1000;
  useEffect(() => {
    let active = true;
    let object = "";
    const abort = new AbortController();
    let renew: ReturnType<typeof setTimeout> | undefined;
    setSource("");
    setError("");
    setDownloaded(0);
    setTotal(0);
    setBuffered(0);
    setWaiting(false);
    async function load() {
      try {
        if (/^\/api\/v1\/audio\/\d+\/stream\/$/.test(url)) {
          const authorize = async () => {
            const grant = await post<{url: string; expires_in: number}>(
              url.replace(/^\/api\/v1\//, "").replace(/stream\/$/, "playback/"), {},
            );
            if (!active) return;
            setSource(grant.url);
            renew = setTimeout(() => {
              void authorize().catch(() => {
                if (active) setError("Audio authorization expired. Retry audio.");
              });
            }, Math.max(1000, (grant.expires_in - 30) * 1000));
          };
          await authorize();
          return;
        }
        let r = await fetch(url, {
          headers: { Authorization: `Bearer ${useAuth.getState().token}` },
          signal: abort.signal,
        });
        if (r.status === 401) {
          await restore();
          r = await fetch(url, {
            headers: { Authorization: `Bearer ${useAuth.getState().token}` },
            signal: abort.signal,
          });
        }
        if (!r.ok) throw new Error("Audio is unavailable. Please try again.");
        setTotal(Number(r.headers.get("Content-Length")) || 0);
        let blob: Blob;
        if (r.body) {
          const reader = r.body.getReader();
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            if (active) setDownloaded(received);
          }
          blob = new Blob(chunks, {
            type: r.headers.get("Content-Type") || "audio/mpeg",
          });
        } else blob = await r.blob();
        if (active) {
          object = URL.createObjectURL(blob);
          setSource(object);
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load audio.");
      }
    }
    void load();
    return () => {
      active = false;
      abort.abort();
      clearTimeout(renew);
      if (object) URL.revokeObjectURL(object);
    };
  }, [url, loadAttempt]);
  useEffect(() => {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = start / 1000;
      setTime(start / 1000);
      setPlaying(false);
    }
  }, [start, end]);
  useEffect(() => {
    if (playRequest === 0) {
      audio.current?.pause();
      return;
    }
    if (playRequest && source && audio.current) {
      audio.current.currentTime = start / 1000;
      void audio.current
        .play()
        .catch(() => setError("Press Play to start audio."));
    }
  }, [playRequest, source, start]);
  useEffect(() => {
    if (!playing || !endTime) return;
    let frame = 0;
    const tick = () => {
      const a = audio.current;
      if (!a) return;
      if (a.currentTime >= endTime) {
        a.pause();
        a.currentTime = endTime;
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, endTime]);
  function toggle() {
    const a = audio.current;
    if (!a || !source) return;
    if (a.paused) {
      if (a.currentTime >= endTime - 0.04 || a.currentTime < start / 1000)
        a.currentTime = start / 1000;
      void a
        .play()
        .catch(() =>
          setError("Playback could not start. Try pressing Play again."),
        );
    } else a.pause();
  }
  function seek(value: number) {
    if (audio.current) {
      audio.current.currentTime = Math.max(
        start / 1000,
        Math.min(value, endTime),
      );
      setTime(audio.current.currentTime);
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.matches("input,textarea,select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        seek(start / 1000);
        if (audio.current) void audio.current.play().catch(() => {});
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const format = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  return (
    <div className="audio-player">
      <audio
        key={`${url}:${loadAttempt}`}
        ref={audio}
        src={source || undefined}
        preload="auto"
        onProgress={() => {
          const a = audio.current;
          if (!a || !Number.isFinite(a.duration) || !a.duration) return;
          let seconds = 0;
          for (let i = 0; i < a.buffered.length; i++) seconds += a.buffered.end(i) - a.buffered.start(i);
          setBuffered(Math.min(100, Math.round(seconds / a.duration * 100)));
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onPlaying={() => setWaiting(false)}
        onLoadedMetadata={() => {
          if (audio.current) {
            setDuration(audio.current.duration);
            audio.current.currentTime = start / 1000;
            audio.current.playbackRate = Number(speed);
            audio.current.volume = volume;
          }
        }}
        onPlay={() => {
          setError("");
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (source) setError("Audio could not load or play. Retry audio.");
        }}
        onTimeUpdate={() => {
          const a = audio.current!;
          if (a.currentTime >= endTime && endTime > 0) {
            a.pause();
            a.currentTime = endTime;
          }
          setTime(a.currentTime);
          onTime?.(a.currentTime * 1000);
        }}
      />
      <div className="audio-top">
        <span className="eyebrow">LISTEN CLOSELY</span>
        <span className="small-label muted">
          {source
            ? waiting ? "Buffering audio…" : buffered > 0 && buffered < 100
              ? `Buffered ${buffered}% · Ready to play`
              : "Space to play · R to replay"
            : error
              ? "Audio unavailable"
              : total > 0
                ? `Loading audio… ${Math.min(100, Math.round((downloaded / total) * 100))}%`
                : "Loading audio…"}
        </span>
      </div>
      <div className="audio-controls">
        <button
          aria-label="Rewind 5 seconds"
          className="icon-button"
          onClick={() => seek(time - 5)}
        >
          <Rewind size={20} />
        </button>
        <button
          className="play-button"
          aria-label={playing ? "Pause audio" : "Play audio"}
          onClick={toggle}
          disabled={!source}
        >
          {playing ? <Pause size={25} /> : <Play size={25} />}
        </button>
        <button
          aria-label="Forward 5 seconds"
          className="icon-button"
          onClick={() => seek(time + 5)}
        >
          <FastForward size={20} />
        </button>
        <div className="audio-timeline">
          <input
            type="range"
            aria-label="Audio position"
            min={start / 1000}
            max={Math.max(endTime, start / 1000 + 0.01)}
            step="0.01"
            value={Math.max(start / 1000, Math.min(time, endTime || 0))}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span>
            {format(Math.max(0, time - start / 1000))}
            <span>{format(Math.max(0, endTime - start / 1000))}</span>
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="Replay segment"
          onClick={() => {
            seek(start / 1000);
            void audio.current?.play().catch(() => {});
          }}
        >
          <RotateCcw size={19} />
        </button>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => {
            setSpeed(e.target.value);
            if (audio.current)
              audio.current.playbackRate = Number(e.target.value);
          }}
        >
          {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <label className="volume">
          <Volume2 size={19} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (audio.current) audio.current.volume = Number(e.target.value);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
          {" "}
          <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>
            Retry audio
          </button>
        </p>
      )}
    </div>
  );
}
