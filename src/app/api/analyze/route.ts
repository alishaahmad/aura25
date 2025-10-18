import { NextResponse } from "next/server";

/** Strip ```json ... ``` fences if the model wraps its JSON */
function stripCodeFences(s: string) {
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

type Normalized = {
  red_flags: { title: string; detail?: string }[];
  budget_swaps: string[];
  meal_plan: { name: string; uses: string[] }[];
  nutrients: { name: string; amount: string }[];
  macros: {
    calories?: string | number;
    protein_g?: string | number;
    carbs_g?: string | number;
    fat_g?: string | number;
    fiber_g?: string | number;
    sugar_g?: string | number;
    sodium_mg?: string | number;
  };
};

/** Ensure the object has all keys we expect */
function normalize(result: any): Normalized {
  const out: Normalized = {
    red_flags: [],
    budget_swaps: [],
    meal_plan: [],
    nutrients: [],
    macros: {},
  };

  // red_flags
  if (Array.isArray(result?.red_flags)) {
    out.red_flags = result.red_flags
      .map((r: any) => ({
        title: String(r?.title ?? r?.reason ?? "Issue"),
        detail: r?.detail ? String(r.detail) : undefined,
      }))
      .filter((r) => r.title);
  }

  // budget_swaps
  if (Array.isArray(result?.budget_swaps)) {
    out.budget_swaps = result.budget_swaps.map((s: any) => String(s)).filter(Boolean);
  }

  // meal_plan
  if (Array.isArray(result?.meal_plan)) {
    out.meal_plan = result.meal_plan
      .map((m: any) => ({
        name: String(m?.name ?? m),
        uses: Array.isArray(m?.uses) ? m.uses.map((u: any) => String(u)) : [],
      }))
      .filter((m) => m.name);
  }

  // nutrients
  if (Array.isArray(result?.nutrients)) {
    out.nutrients = result.nutrients
      .map((n: any) => ({
        name: String(n?.name ?? ""),
        amount: String(n?.amount ?? ""),
      }))
      .filter((n) => n.name);
  }

  // macros (accept many aliases; normalize)
  const mac = result?.macros ?? {};
  const pick = (keys: string[]) =>
    keys.map((k) => mac?.[k]).find((v: any) => v !== undefined && v !== null);

  out.macros = {
    calories: pick(["calories", "kcal", "energy_kcal"]),
    protein_g: pick(["protein_g", "protein", "proteinGrams"]),
    carbs_g: pick(["carbs_g", "carbohydrates_g", "carbs", "carbohydrates"]),
    fat_g: pick(["fat_g", "total_fat_g", "fat"]),
    fiber_g: pick(["fiber_g", "fiber"]),
    sugar_g: pick(["sugar_g", "sugars_g", "sugar"]),
    sodium_mg: pick(["sodium_mg", "sodium"]),
  };

  // stringify numbers consistently
  Object.keys(out.macros).forEach((k) => {
    const val: any = (out.macros as any)[k];
    if (val !== undefined && val !== null && typeof val !== "string") {
      (out.macros as any)[k] = String(val);
    }
  });

  return out;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    // Text from client-side OCR (required)
    const providedText = (form.get("text") as string | null)?.trim() || "";
    if (!providedText) {
      return NextResponse.json(
        {
          error:
            "No 'text' provided. This endpoint expects extracted label/receipt text (OCR runs in the browser).",
        },
        { status: 422 }
      );
    }

    // Optional overrides
    const provider = (form.get("provider") as string) || "openrouter";
    const modelFromForm = (form.get("model") as string) || "";
    const profileFromForm = (form.get("profile") as string) || "";

    // Profile: form value wins, otherwise default
    const profileRaw =
      profileFromForm ||
      '{"meds":["atorvastatin"],"allergies":["peanut"],"goals":["low-sodium"]}';

    if (provider !== "openrouter") {
      return NextResponse.json(
        { error: "Only provider=openrouter is enabled in this build." },
        { status: 400 }
      );
    }

    // OpenRouter config
    const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(
      /\/$/,
      ""
    );
    const endpoint = `${base}/chat/completions`;
    const model = modelFromForm || "gpt-4o-mini"; // good default

    const systemPrompt = `
You are a nutrition and ingredients analyst.
Return ONLY JSON (no prose). Schema:
{
  "red_flags": [{"title": "string", "detail": "string"}],
  "budget_swaps": ["string"],
  "meal_plan": [{"name":"string", "uses":["string"]}],
  "nutrients": [{"name":"string","amount":"string"}],
  "macros": {
    "calories": "string|number",
    "protein_g": "string|number",
    "carbs_g": "string|number",
    "fat_g": "string|number",
    "fiber_g": "string|number",
    "sugar_g": "string|number",
    "sodium_mg": "string|number"
  }
}
Rules:
- Ground all findings in the provided text (ingredients/receipt). Do NOT invent items.
- If exact numbers are unavailable, provide reasonable estimates and mark them clearly (e.g., "~12 g").
- Consider the user's profile (meds, allergies, goals) for flags.
- Keep items concise and useful.
`;

    const userPrompt = `Extracted text:\n${providedText}\n\nUser profile (JSON):\n${profileRaw}\n\nReturn ONLY the JSON object described in the schema.`;

    const openrouterRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Receipt Relief (dev)",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    const bodyText = await openrouterRes.text();
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error(
        `OpenRouter returned non-JSON (${openrouterRes.status} ${openrouterRes.statusText})`
      );
    }

    if (!openrouterRes.ok) {
      throw new Error(
        data?.error?.message || data?.error || `OpenRouter error ${openrouterRes.status}`
      );
    }

    // Model content may be a JSON string (possibly wrapped in code fences)
    let content = data?.choices?.[0]?.message?.content ?? "{}";
    if (typeof content === "string") {
      content = stripCodeFences(content);
      try {
        content = JSON.parse(content);
      } catch {
        // return empty normalized analysis but include raw for debugging
        return NextResponse.json({
          provider,
          model,
          profile: JSON.parse(profileRaw),
          ocr_preview: providedText.slice(0, 1000),
          analysis: normalize({}), // empty
          raw: data?.choices?.[0]?.message?.content,
          note: "Model did not return valid JSON; returned normalized empty analysis.",
        });
      }
    }

    const normalized = normalize(content);

    return NextResponse.json({
      provider,
      model,
      profile: JSON.parse(profileRaw),
      ocr_preview: providedText.slice(0, 1000),
      analysis: normalized,
    });
  } catch (err: any) {
    console.error("Error in /api/analyze:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
