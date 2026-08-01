import { deleteSession, getSessionUser } from "@/db/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401, headers });
    return Response.json({ user }, { headers });
  } catch {
    return Response.json({ error: "로그인 상태를 확인하지 못했어요." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  try {
    await deleteSession(request);
    return new Response(null, { status: 204, headers });
  } catch {
    return Response.json({ error: "로그아웃하지 못했어요." }, { status: 503, headers });
  }
}
