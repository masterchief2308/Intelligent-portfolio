import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://intelligent-portfolio-backend-702455616797.asia-south1.run.app';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role, company } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!BACKEND_URL) {
      return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

    const backendResponse = await fetch(`${BACKEND_URL}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, company }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    console.warn(`Backend returned ${backendResponse.status}, throwing error`);
    return NextResponse.json({ error: `Backend returned ${backendResponse.status}` }, { status: backendResponse.status });

  } catch (error) {
    console.error("Personalization failed:", error);
    return NextResponse.json({ error: "Failed to connect to backend" }, { status: 500 });
  }
}
