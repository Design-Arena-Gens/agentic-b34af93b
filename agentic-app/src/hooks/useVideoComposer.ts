"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { AgentOutput } from "@/lib/types";

type ComposeOptions = {
  payload: AgentOutput;
};

type ComposeResult = {
  videoUrl: string;
  durationSeconds: number;
};

function base64ToUint8Array(base64: string) {
  const binaryString = typeof window === "undefined" ? "" : atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function mapSegmentsToDuration(payload: AgentOutput, totalDuration: number) {
  const totalScriptDuration = payload.segments.reduce((acc, segment) => acc + segment.duration, 0);
  let cumulative = 0;

  return payload.segments.map((segment, index) => {
    const start = cumulative / totalScriptDuration;
    cumulative += segment.duration;
    const end = cumulative / totalScriptDuration;

    const startMs = start * totalDuration;
    const endMs = end * totalDuration;

    return {
      ...segment,
      index,
      window: [startMs, endMs] as const,
    };
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, hue: number) {
  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, `hsl(${hue}, 90%, 12%)`);
  gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 82%, 20%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, subtitle: string, progress: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(40, 40, 1200, 640);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(40, 620, 1200, 40);

  ctx.fillStyle = "rgba(0, 255, 225, 0.4)";
  ctx.fillRect(40, 620, 1200 * progress, 40);

  ctx.fillStyle = "white";
  ctx.font = "bold 56px 'Geist Sans', sans-serif";
  ctx.fillText(title, 80, 160, 1120);

  ctx.font = "28px 'Geist Sans', sans-serif";
  wrapText(ctx, subtitle, 80, 240, 1100, 42);

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = `${line}${words[n]} `;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = `${words[n]} `;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

export function useVideoComposer() {
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const compose = useCallback(async ({ payload }: ComposeOptions): Promise<ComposeResult> => {
    if (typeof window === "undefined") {
      throw new Error("Video composition must run in the browser");
    }

    setIsRendering(true);
    setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to acquire canvas context");
    }

    const audioContext = new AudioContext();
    await audioContext.resume();
    const audioBytes = base64ToUint8Array(payload.voiceover.audioBase64);
    const audioBuffer = await audioContext.decodeAudioData(audioBytes.buffer.slice(0));

    const audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;

    const destination = audioContext.createMediaStreamDestination();
    audioSource.connect(destination);
    audioSource.connect(audioContext.destination);

    const videoStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    const hueBase = Math.floor(Math.random() * 360);
    const segments = mapSegmentsToDuration(payload, audioBuffer.duration * 1000);
    const renderStart = performance.now();

    const renderLoop = () => {
      const now = performance.now();
      const elapsed = now - renderStart;
      const progress = Math.min(elapsed / (audioBuffer.duration * 1000), 1);
      const activeSegment =
        segments.find((segment) => elapsed >= segment.window[0] && elapsed < segment.window[1]) ??
        segments[segments.length - 1];

      const hue = (hueBase + activeSegment.index * 32) % 360;
      drawBackground(ctx, hue);
      drawOverlay(ctx, activeSegment.title, activeSegment.script, progress);

      if (elapsed < audioBuffer.duration * 1000) {
        requestAnimationFrame(renderLoop);
      }
    };

    return new Promise<ComposeResult>((resolve, reject) => {
      recorder.onstop = () => {
        const blendedBlob = new Blob(recordedChunks, { type: "video/webm" });
        const objectUrl = URL.createObjectURL(blendedBlob);
        setIsRendering(false);
        resolve({
          videoUrl: objectUrl,
          durationSeconds: audioBuffer.duration,
        });
      };

      recorder.onerror = (event) => {
        setIsRendering(false);
        const message = (event.error && event.error.message) || "MediaRecorder error";
        setError(message);
        reject(new Error(message));
      };

      try {
        recorder.start(250);
        renderLoop();
        audioSource.start();
        audioSource.onended = () => {
          recorder.stop();
          audioContext.close();
        };
      } catch (compositionError) {
        recorder.stop();
        audioContext.close();
        setIsRendering(false);
        const message = compositionError instanceof Error ? compositionError.message : "Render failed";
        setError(message);
        reject(compositionError instanceof Error ? compositionError : new Error(message));
      }
    });
  }, []);

  const state = useMemo(
    () => ({
      isRendering,
      error,
      cancel: () => {
        recorderRef.current?.stop();
      },
    }),
    [error, isRendering],
  );

  return {
    compose,
    state,
  };
}

