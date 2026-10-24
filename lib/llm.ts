import { getSetting } from "./db";

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function llmConfig(): LlmConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY || getSetting("deepseek_api_key") || "";
  if (!apiKey.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    baseUrl: (getSetting("deepseek_base_url") || "https://api.deepseek.com").replace(/\/+$/, ""),
    model: getSetting("deepseek_model") || "deepseek-chat",
  };
}

function stripFences(s: string) {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = m ? m[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La respuesta del modelo no contiene JSON");
  return body.slice(start, end + 1);
}

export async function chatJson<T = unknown>(
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<{ json: T; tokens: number }> {
  const cfg = llmConfig();
  if (!cfg) throw new Error("No hay API key de DeepSeek configurada");

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 6000,
      stream: false,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek devolvió una respuesta vacía");

  return {
    json: JSON.parse(stripFences(content)) as T,
    tokens: data.usage?.total_tokens ?? 0,
  };
}

export async function testConnection(): Promise<string> {
  const { json } = await chatJson<{ ok: boolean }>(
    'Respondé únicamente con JSON: {"ok": true}',
    "ping",
    { maxTokens: 20 }
  );
  return json.ok ? "Conexión OK" : "Respuesta inesperada";
}
