import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ url: null });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || accessKey === "your_unsplash_access_key_here") {
    return NextResponse.json({ url: null });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape&content_filter=high`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        next: { revalidate: 3600 }, // cache each query for 1 hour
      }
    );

    if (!res.ok) {
      return NextResponse.json({ url: null });
    }

    const data = await res.json();
    const url: string | null = data.results?.[0]?.urls?.regular ?? null;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
