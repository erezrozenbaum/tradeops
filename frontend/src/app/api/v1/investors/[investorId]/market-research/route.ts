import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { investorId } = await params;
  const url = `${BACKEND}/api/v1/investors/${investorId}/market-research`;
  const cookie = request.headers.get("cookie") ?? "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
        headers: { cookie },
      });

      if (!res.ok) {
        await res.text().catch(() => ""); // consume body; do not forward internals
        return NextResponse.json(
          { error: "Backend error" },
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
