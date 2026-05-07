import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { investorId: string } }
) {
  const url = `${BACKEND}/api/v1/investors/${params.investorId}/market-research`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return NextResponse.json(
          { error: "Backend error", detail: body },
          { status: res.status }
        );
      }

      return NextResponse.json(await res.json());
    } catch (err) {
      const msg = String(err);
      const isReset =
        msg.includes("ECONNRESET") ||
        msg.includes("socket hang up") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("fetch failed") ||
        msg.includes("TimeoutError");

      if (isReset && attempt < 3) {
        await new Promise((r) => setTimeout(r, 8000 * attempt));
        continue;
      }

      return NextResponse.json(
        { error: "Network error", detail: msg },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Market research unavailable" }, { status: 502 });
}
