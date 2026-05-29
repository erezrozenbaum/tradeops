import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { investorId } = await params;
  const url = `${BACKEND}/api/v1/investors/${investorId}/recommendations`;
  const cookie = request.headers.get("cookie") ?? "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(90_000),
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

  return NextResponse.json({ error: "Recommendations unavailable" }, { status: 502 });
}
