import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  approved: z.boolean().default(true),
});

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/clips/[id]/approve-still
 *
 * Storyboard approval toggle. Gates /animate in the UI so the user
 * confirms each still before burning a ~30¢ video render. Body is
 * optional — omit to approve, or pass {approved: false} to un-approve.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = { approved: true };
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("clips")
    .update({ still_approved: body.approved })
    .eq("id", id)
    .select("id, still_approved")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...data });
}
