import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAgentOutput } from "@/lib/agent-engine";
import { synthesizeVoiceover } from "@/lib/voiceover";

const requestSchema = z.object({
  goal: z.string().min(3),
  audience: z.string().min(3),
  durationMinutes: z.number().min(3).max(30),
  tone: z.enum(["inspirational", "educational", "dramatic", "calm"]),
  monetization: z.enum(["adsense", "affiliate", "digital-products", "brand-deals", "mixed"]),
  openAiKey: z.string().min(16).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const openAiKey = payload.openAiKey?.trim() ? payload.openAiKey.trim() : undefined;

    const agentPlan = buildAgentOutput({
      ...payload,
      openAiKey,
    });

    const voiceover = await synthesizeVoiceover({
      script: agentPlan.script,
      voiceStyle: payload.tone === "dramatic" ? "harper" : "narrator",
      openAiKey,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...agentPlan,
        voiceover,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}

