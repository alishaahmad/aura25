"use client";

import { useState } from "react";
import Tesseract from "tesseract.js";

type UserProfile = {
  meds: string[];
  allergies: string[];
  goals: string[];
};

type AnalysisResult = {
  redFlags: {
    severity: "info" | "warn" | "danger";
    reason: string;
    recommendation?: string;
  }[];
  healthySwaps: { from: string; to: string; why: string; estSavings?: string }[];
  mealPlan: { title: string; meals: { name: string; uses: string[] }[] };
  ocr_preview?: string;
  macros?: {
    calories?: string | number;
    protein_g?: string | number;
    carbs_g?: string | number;
    fat_g?: string | number;
    fiber_g?: string | number;
    sugar_g?: string | number;
    sodium_mg?: string | number;
  };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    meds: ["atorvastatin"],
    allergies: ["peanut"],
    goals: ["low-sodium"],
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string>("");

  async function handleIngest() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setOcrPreview("");

    try {
      // 1) OCR in the browser
      const { data } = await Tesseract.recognize(file, "eng", { logger: () => {} });
      const text = (data?.text || "").trim();
      if (!text) throw new Error("Could not read any text from the image.");
      setOcrPreview(text.slice(0, 1000));

      // 2) Send OCR text to backend for analysis (OpenRouter)
      const form = new FormData();
      form.append("text", text);
      form.append("provider", "openrouter");
      form.append("model", "gpt-4o-mini"); // change if you want to try others
      form.append("profile", JSON.stringify(profile));

      const res = await fetch("/api/analyze", { method: "POST", body: form });

      const responseText = await res.text();
      let dataJson: any;
      try {
        dataJson = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned non-JSON (${res.status} ${res.statusText}). Body: ${responseText.slice(
            0,
            120
          )}…`
        );
      }
      if (!res.ok) throw new Error(dataJson.error || "Request failed");

      // The server already normalized the structure
      const server = dataJson.analysis || {};

      // Prefer server.healthy_swaps, but fall back to server.budget_swaps for compatibility
      const swapsRaw: string[] = server.healthy_swaps ?? server.budget_swaps ?? [];

      const finalResult: AnalysisResult = {
        redFlags: (server.red_flags || []).map((r: any) => ({
          severity: "danger",
          reason: r.title,
          recommendation: r.detail,
        })),
        healthySwaps: swapsRaw.map((s: string) => {
          const [from, to] = s.split("→").map((x) => x?.trim());
          return { from: from || s, to: to || "", why: "" };
        }),
        mealPlan: {
          title: "3-Day Smart Meal Plan",
          meals: (server.meal_plan || []).map((m: any) => ({
            name: m.name,
            uses: m.uses || [],
          })),
        },
        ocr_preview: dataJson.ocr_preview,
        macros: server.macros || {},
      };

      setAnalysis(finalResult);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Receipt→Relief</h1>
      <p className="text-sm opacity-70">
        Upload a grocery or restaurant receipt → get red flags, healthy swaps, macros, and meal plan
        ideas.
      </p>

      {/* Upload & Profile */}
      <section className="grid gap-4 rounded-2xl border p-4">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <textarea
          className="w-full rounded-md border p-2 text-sm"
          placeholder='Enter your profile (JSON). Example: {"meds":["atorvastatin"],"allergies":["peanut"],"goals":["low-sodium"]}'
          defaultValue={JSON.stringify(profile, null, 2)}
          onBlur={(e) => {
            try {
              setProfile(JSON.parse(e.target.value));
              setError(null);
            } catch {
              setError("Invalid JSON format in profile");
            }
          }}
        />
        <button
          onClick={handleIngest}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={!file || loading}
        >
          {loading ? "Analyzing…" : "Analyze Receipt"}
        </button>
        <p className="text-xs text-gray-500">Not medical advice. For educational purposes only.</p>
      </section>

      {/* Errors */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* OCR Preview */}
      {ocrPreview && (
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold">OCR Preview</h2>
          <pre className="whitespace-pre-wrap text-xs opacity-80">{ocrPreview}</pre>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <section className="grid gap-6">
          {/* Red Flags */}
          <div className="rounded-2xl border p-4">
            <h2 className="font-semibold">Red Flags</h2>
            <ul className="mt-2 space-y-2">
              {analysis.redFlags.map((f, i) => (
                <li key={i} className="rounded-lg border border-red-500 p-3">
                  <div className="font-medium">{f.reason}</div>
                  {f.recommendation && (
                    <div className="text-sm opacity-80">{f.recommendation}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Macros */}
          {analysis.macros && (
            <div className="rounded-2xl border p-4">
              <h2 className="font-semibold">Macros (estimated)</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {analysis.macros.calories && (
                  <li className="rounded-lg border p-2">
                    <b>Calories</b>: {analysis.macros.calories}
                  </li>
                )}
                {analysis.macros.protein_g && (
                  <li className="rounded-lg border p-2">
                    <b>Protein</b>: {analysis.macros.protein_g} g
                  </li>
                )}
                {analysis.macros.carbs_g && (
                  <li className="rounded-lg border p-2">
                    <b>Carbs</b>: {analysis.macros.carbs_g} g
                  </li>
                )}
                {analysis.macros.fat_g && (
                  <li className="rounded-lg border p-2">
                    <b>Fat</b>: {analysis.macros.fat_g} g
                  </li>
                )}
                {analysis.macros.fiber_g && (
                  <li className="rounded-lg border p-2">
                    <b>Fiber</b>: {analysis.macros.fiber_g} g
                  </li>
                )}
                {analysis.macros.sugar_g && (
                  <li className="rounded-lg border p-2">
                    <b>Sugar</b>: {analysis.macros.sugar_g} g
                  </li>
                )}
                {analysis.macros.sodium_mg && (
                  <li className="rounded-lg border p-2">
                    <b>Sodium</b>: {analysis.macros.sodium_mg} mg
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Healthy Swaps */}
          <div className="rounded-2xl border p-4">
            <h2 className="font-semibold">Healthy Swaps</h2>
            <ul className="mt-2 list-disc pl-5">
              {analysis.healthySwaps.map((s, i) => (
                <li key={i}>
                  <b>{s.from}</b>
                  {s.to ? (
                    <>
                      {" "}
                      → <b>{s.to}</b>
                    </>
                  ) : null}{" "}
                  {s.why && <span className="opacity-70">({s.why})</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Meal Plan */}
          <div className="rounded-2xl border p-4">
            <h2 className="font-semibold">{analysis.mealPlan.title}</h2>
            <ul className="mt-2 space-y-2">
              {analysis.mealPlan.meals.map((m, i) => (
                <li key={i} className="rounded-lg border p-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs opacity-70">Uses: {m.uses.join(", ")}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}


