import { NextResponse } from "next/server";
import { allSettings, getSetting, setSetting } from "@/lib/db";
import { llmConfig, testConnection } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = allSettings();
  const key = s.deepseek_api_key || process.env.DEEPSEEK_API_KEY || "";
  return NextResponse.json({
    model: s.deepseek_model || "deepseek-chat",
    baseUrl: s.deepseek_base_url || "https://api.deepseek.com",
    maxPages: Number(s.max_pages || 24),
    hasKey: Boolean(key),
    keyHint: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : "",
    usingEnv: !s.deepseek_api_key && Boolean(process.env.DEEPSEEK_API_KEY),
  });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (typeof body.apiKey === "string") setSetting("deepseek_api_key", body.apiKey.trim());
  if (typeof body.model === "string" && body.model.trim()) setSetting("deepseek_model", body.model.trim());
  if (typeof body.baseUrl === "string" && body.baseUrl.trim()) setSetting("deepseek_base_url", body.baseUrl.trim());
  if (body.maxPages != null) setSetting("max_pages", String(Number(body.maxPages) || 24));
  return NextResponse.json({ ok: true });
}

export async function POST() {
  if (!llmConfig()) return NextResponse.json({ ok: false, error: "No hay API key configurada" }, { status: 400 });
  try {
    const msg = await testConnection();
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

