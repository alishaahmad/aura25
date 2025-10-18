import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { render } from "@react-email/components";
import { Resend } from "resend";
import AuraMonthlyReport from "../../../emails/AuraMonthlyReport";

const OUT_DIR = path.join(process.cwd(), "tmp");
const OUT_FILE = path.join(OUT_DIR, "aura-preview.html");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SHOULD_SEND = process.env.SEND === "true";
const FROM = process.env.FROM || "Aura Health <hello@tryaura.health>";
const TO = process.env.TO || "your.email@example.com";

async function main() {
  const maybeHtml = render(
    AuraMonthlyReport({
      userName: "Test User",
      month: "November",
      year: 2025,
      auraScore: 78,
      scoreDescription: "You're on the right track—keep making small changes for even better results!",
    })
  );
  const html = await Promise.resolve(maybeHtml);

  if (!SHOULD_SEND || !RESEND_API_KEY) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, html, "utf8");
    console.log(`Preview written to ${OUT_FILE}`);
    try {
      execSync(`open ${OUT_FILE}`);
      console.log("Opened preview in default browser.");
    } catch {
      console.log("Could not open browser automatically.");
    }
    return;
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    const resp = await resend.emails.send({
      from: "Aura Health <hello@tryaura.health>",
      to: TO,
      subject: "Your November Health Snapshot from Aura 🌟",
      html,
    });
    console.log("Email sent successfully!");
    console.log("Send response:", resp);
  } catch (err: any) {
    console.error("Send error (full):", err);
    try {
      console.error("err.response?.data:", JSON.stringify(err?.response?.data, null, 2));
    } catch {}
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});