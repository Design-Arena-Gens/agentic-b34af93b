"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Download, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import { useVideoComposer } from "@/hooks/useVideoComposer";
import type { AgentOutput, AgentFormValues } from "@/lib/types";

type Step =
  | "idle"
  | "planning"
  | "scripting"
  | "voiceover"
  | "rendering"
  | "complete"
  | "error";

const defaultValues: AgentFormValues = {
  goal: "Grow a faceless channel that sells AI workflow templates for digital creators.",
  audience: "Bootstrapped solopreneurs and creators building leverage with automation.",
  durationMinutes: 8,
  tone: "educational",
  monetization: "mixed",
  openAiKey: "",
};

const stepsOrder: { id: Step; label: string }[] = [
  { id: "planning", label: "Niche Strategy" },
  { id: "scripting", label: "Script Lab" },
  { id: "voiceover", label: "Voiceover Forge" },
  { id: "rendering", label: "Video Assembly" },
  { id: "complete", label: "Delivery" },
];

function base64ToBlob(base64: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default function Home() {
  const [form, setForm] = useState(defaultValues);
  const [step, setStep] = useState<Step>("idle");
  const [status, setStatus] = useState<string>("Define your channel and launch the automation stack.");
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isPackaging, setIsPackaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { compose, state: composerState } = useVideoComposer();

  const activeStepIndex = useMemo(() => {
    if (step === "idle") return -1;
    return stepsOrder.findIndex((item) => item.id === step);
  }, [step]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setVideoUrl(null);
    setStep("planning");
    setStatus("Mapping the most profitable niche against your goal...");

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          durationMinutes: Number.isNaN(form.durationMinutes)
            ? defaultValues.durationMinutes
            : form.durationMinutes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Request failed");
      }

      const payload = await response.json();
      setStep("voiceover");
      setStatus("Generating studio-grade voiceover and delivery assets...");
      setOutput(payload.data as AgentOutput);

      setStep("rendering");
      setStatus("Composing the faceless video with kinetic visuals...");

      const video = await compose({ payload: payload.data });
      setVideoUrl(video.videoUrl);
      setVideoDuration(video.durationSeconds);

      setStep("complete");
      setStatus("Automation package is ready. Download and publish!");
    } catch (agentError) {
      const message =
        agentError instanceof Error ? agentError.message : "Agent pipeline failed. Try again.";
      setError(message);
      setStep("error");
      setStatus("Something interrupted the pipeline. Adjust inputs and relaunch.");
    }
  };

  const handlePackageDownload = async () => {
    if (!output) return;
    setIsPackaging(true);
    try {
      const zip = new JSZip();
      zip.file("script.md", output.script);
      zip.file(
        "metadata.json",
        JSON.stringify(
          {
            title: output.videoTitle,
            description: output.summary,
            tags: output.tags,
            thumbnailPrompt: output.thumbnailPrompt,
            niche: output.niche,
            dataSources: output.dataSources,
          },
          null,
          2,
        ),
      );
      zip.file("tags.txt", output.tags.join(", "));

      const audioBlob = base64ToBlob(output.voiceover.audioBase64, output.voiceover.mimeType);
      zip.file("voiceover.mp3", audioBlob);

      if (videoUrl) {
        const response = await fetch(videoUrl);
        const videoBlob = await response.blob();
        zip.file("video.webm", videoBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "faceless-channel-package.zip";
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:px-10">
        <header className="flex flex-col items-start gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-emerald-300">
            <Sparkles className="h-4 w-4" />
            Faceless Channel Automation Agent
          </div>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Launch a fully automated YouTube workflow — from niche intelligence to rendered video —
            without ever showing your face.
          </h1>
          <p className="text-zinc-400">
            Feed the agent your mission, audience, and vibe. It will engineer the niche playbook,
            craft the script, synthesize the voiceover, assemble a video, and package tags plus
            prompts ready to publish today.
          </p>
        </header>

        <main className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl shadow-black/30 backdrop-blur">
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Channel Blueprint</h2>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={composerState.isRendering || step === "rendering"}
                >
                  <Wand2 className="h-4 w-4" />
                  {step === "rendering" || composerState.isRendering ? "Composing..." : "Deploy Agent"}
                </button>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-300">Channel Mission</span>
                <textarea
                  className="min-h-[96px] rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 shadow-inner shadow-black/20 focus:border-emerald-400 focus:outline-none"
                  value={form.goal}
                  onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value }))}
                  placeholder="Describe the transformation you want each video to deliver."
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-300">Primary Audience</span>
                <textarea
                  className="min-h-[80px] rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 shadow-inner shadow-black/20 focus:border-emerald-400 focus:outline-none"
                  value={form.audience}
                  onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
                  placeholder="Who are you servicing and what do they obsess over?"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-300">Video Length (minutes)</span>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        durationMinutes: Number(event.target.value) || prev.durationMinutes,
                      }))
                    }
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-300">Narrative Tone</span>
                  <select
                    value={form.tone}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tone: event.target.value as AgentFormValues["tone"],
                      }))
                    }
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="educational">Educational</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="dramatic">Dramatic</option>
                    <option value="calm">Calm &amp; soothing</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-300">Monetization Stack</span>
                  <select
                    value={form.monetization}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        monetization: event.target.value as AgentFormValues["monetization"],
                      }))
                    }
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="mixed">Mixed / hybrid</option>
                    <option value="adsense">AdSense RPM</option>
                    <option value="affiliate">Affiliate Offers</option>
                    <option value="digital-products">Digital Products</option>
                    <option value="brand-deals">Brand Deals</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-300">OpenAI API Key (optional)</span>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={form.openAiKey}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, openAiKey: event.target.value.trim() }))
                  }
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
                />
                <span className="text-xs text-zinc-500">
                  Drop your key for premium narration. Leave empty to auto-fallback to Google TTS.
                </span>
              </label>

              {error && (
                <div className="rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </form>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-inner shadow-black/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  {composerState.isRendering || step === "rendering" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-400">Pipeline Status</span>
                  <span className="text-base font-semibold text-zinc-100">{status}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {stepsOrder.map((item, index) => {
                  const isActive = activeStepIndex >= index && activeStepIndex !== -1 && step !== "error";
                  const isCurrent = activeStepIndex === index;
                  const isComplete = activeStepIndex > index;

                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                          isComplete
                            ? "border-emerald-400 bg-emerald-500/30 text-emerald-200"
                            : isCurrent
                              ? "border-emerald-400/60 bg-zinc-900 text-emerald-200"
                              : isActive
                                ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                                : "border-zinc-800 bg-zinc-950 text-zinc-600"
                        }`}
                      >
                        {isComplete ? "✓" : index + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-xs text-zinc-500">
                          {isComplete
                            ? "Completed"
                            : isCurrent
                              ? "In progress"
                              : "Queued for automation"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {output && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm uppercase tracking-wide text-emerald-300">
                      Niche Locked
                    </span>
                    <h3 className="text-2xl font-semibold text-emerald-100">{output.niche}</h3>
                    <p className="mt-2 text-sm text-emerald-200/70">{output.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePackageDownload}
                    disabled={isPackaging}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPackaging ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Build Package
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                      Video Title
                    </h4>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">{output.videoTitle}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                      Tags
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {output.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                      Thumbnail Prompt
                    </h4>
                    <p className="mt-2 text-sm text-emerald-100/80">{output.thumbnailPrompt}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                      Script Beats
                    </h4>
                    <div className="mt-3 space-y-3">
                      {output.segments.map((segment) => (
                        <div
                          key={segment.id}
                          className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-emerald-100">{segment.title}</h5>
                            <span className="text-xs text-emerald-200/70">
                              {Math.round(segment.duration / 60)}s
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-emerald-100/80">{segment.script}</p>
                          <p className="mt-3 text-xs uppercase tracking-wide text-emerald-300/80">
                            Visual Prompt: {segment.visualPrompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {videoUrl && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h3 className="text-lg font-semibold text-zinc-100">Rendered Preview</h3>
                <video
                  src={videoUrl}
                  controls
                  className="mt-4 w-full rounded-2xl border border-zinc-800"
                />
                <p className="mt-3 text-xs text-zinc-500">
                  Duration ~ {videoDuration?.toFixed(1)}s • Voiceover engine: {output?.voiceover.voiceName}{" "}
                  ({output?.voiceover.provider})
                </p>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
