import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

const KV_KEY_PREFIX = "anon:";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anon_id, userData } = body as {
      anon_id?: string;
      userData?: unknown;
    };

    if (!anon_id || typeof anon_id !== "string" || anon_id.trim() === "") {
      return NextResponse.json(
        { error: "anon_id is required" },
        { status: 400 }
      );
    }

    const key = `${KV_KEY_PREFIX}${anon_id}`;
    await kv.set(key, userData ?? {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/sync]", err);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
