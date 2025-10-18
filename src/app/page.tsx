"use client";

import { useState } from "react";

type UserProfile = {
  meds: string[];
  allergies: string[];
  goals: string[];
};

type ParsedReceipt = {
  store: string;
  purchasedAt?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  items: { rawName: string; qty?: number; unitPrice?: number; normalized?: string }[];
};

type RedFlag = {
  severity: "info" | "warn" | "danger";
  reason: string;
  evidence?: string[];
  recommendation?: string;
};

type AnalysisResult = {
  redFlags: RedFlag[];
  budgetSwaps: { from: string; to: string; why: string; estSavings?: string }[];
  mealPlan: { title: string; meals: { name: string; uses: string[]; steps?: string[] }[] };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    meds: [],
    allergies: [],
    goals: ["high-protein"],
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleIngest() {
    if (!file) return;
    setLoading(true);

    // mock analysis for now — this will be replaced with API calls later
    const mockAnalysis: AnalysisResult = {
      redFlags: [
        {
          severity: "warn",
          reason: "‘Grapefruit juice’ may interact with atorvastatin.",
          recommendation: "Avoid grapefruit or consult your doctor.",
        },
        {
          severity: "danger",
          reason: "Possible peanut allergen found in ‘Trail Mix’",
          recommendation: "Choose a peanut-free snack alternative.",
        },
      ],
      budgetSwaps: [
        {
          from: "Organic Spinach",
          to: "Conventional Spinach",
          why: "Similar nutrition at lower cost",
          estSavings: "~15%",
        },
      ],
      mealPlan: {
        title: "3-Day Smart Meal Plan",
        meals: [
          { name: "Greek Yogurt Parfait", uses: ["Chobani Yogurt", "Berries", "Oats"] },
          { name: "Spinach Chicken Bowl", uses: ["Spinach", "Brown Rice", "Rotisserie Chicken"] },
        ],
      },
    };

    // simulate delay
    await new Promise((res) => setTimeout(res, 1000));

    setAnalysis(mockAnalysis);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Receipt→Relief</h1>
      <p className="text-sm opacity-70">
        Upload a grocery or restaurant receipt → get red flags, swaps, and meal plan ideas.
      </p>

      {/* upload section */}
      <section className="grid gap-4 rounded-2xl border p-4">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <textarea
          className="w-full rounded-md border p-2 text-sm"
          placeholder='Enter your profile (JSON). Example: {"meds":["atorvastatin"],"allergies":["peanut"],"goals":["low-sodium"]}'
          onBlur={(e) => {
            try {
              setProfile(JSON.parse(e.target.value));
            } catch {}
          }}
        />
        <button
          onClick={handleIngest}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={!file || loading}
        >
          {loading ? "Analyzing…" : "Analyze Receipt"}
        </button>
        <p className="text-xs text-gray-500">
          Not medical advice. For educational purposes only.
        </p>
      </section>

      {/* results */}
      {analysis && (
        <section className="grid gap-6">
          {/* red flags */}
          <div className="rounded-2xl border p-4">
            <h2 className="font-semibold">Red Flags</h2>
            <ul className="mt-2 space-y-2">
              {analysis.redFlags.map((f, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-3 ${
                    f.severity === "danger" ? "border-red-500" : "border-yellow-400"
                  }`}
                >
                  <div className="font-medium">{f.reason}</div>
                  {f.recommendation && (
                    <div className="text-sm opacity-80">{f.recommendation}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* budget swaps */}
          <div className="rounded-2xl border p-4">
            <h2 className="font-semibold">Budget-Friendly Swaps</h2>
            <ul className="mt-2 list-disc pl-5">
              {analysis.budgetSwaps.map((s, i) => (
                <li key={i}>
                  <b>{s.from}</b> → <b>{s.to}</b>{" "}
                  <span className="opacity-70">
                    ({s.why}
                    {s.estSavings ? `, ${s.estSavings}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* meal plan */}
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
