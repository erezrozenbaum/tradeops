import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(
  _request: NextRequest,
  { params }: { params: { investorId: string } }
) {
  const url = `${BACKEND}/api/v1/investors/${params.investorId}/ai-report`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return NextResponse.json(
          { error: "Backend error", detail: body },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json(data);
    } catch (err) {
      const msg = String(err);
      const isReset =
        msg.includes("ECONNRESET") ||
        msg.includes("socket hang up") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("fetch failed");

      if (isReset && attempt < 3) {
        await new Promise((r) => setTimeout(r, 6000 * attempt));
        continue;
      }

      return NextResponse.json(
        { error: "Network error", detail: msg },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Report unavailable" }, { status: 502 });
}
