import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL ?? "http://backend:8000";

async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const url = `${BACKEND}${path}${search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.blob();
  }

  try {
    const upstream = await fetch(url, { method: request.method, headers, body });
    const responseHeaders = new Headers(upstream.headers);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
