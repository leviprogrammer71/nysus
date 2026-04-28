import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { cancelPrediction } from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/delete
 *
 * Hard-delete a project: cancel any in-flight predictions, wipe the
 * storage prefix, then drop the row (which cascades to clips,
 * messages, likes, etc).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // Ownership via RLS.
  const { data: project, error: readErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createServiceRoleClient();

  // Cancel in-flight predictions (best-effort).
  const { data: inflight } = await admin
    .from("clips")
    .select("replicate_prediction_id")
    .eq("project_id", project.id)
    .in("status", ["queued", "processing"])
    .not("replicate_prediction_id", "is", null);
  for (const row of inflight ?? []) {
    if (row.replicate_prediction_id) {
      try {
        await cancelPrediction(row.replicate_prediction_id);
      } catch {
        /* ignore */
      }
    }
  }

  // Wipe storage prefix (best-effort, recursive).
  try {
    await deleteStoragePrefix(admin, "clips", `${project.id}/`);
  } catch (err) {
    console.warn("storage purge failed:", err);
  }

  // Drop the row — cascades to clips/messages/likes.
  const { error: delErr } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function deleteStoragePrefix(
  admin: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  prefix: string,
): Promise<void> {
  // List + remove. Storage list returns folder entries with
  // metadata=null which we recurse into.
  const { data: entries } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (!entries || entries.length === 0) return;

  const files: string[] = [];
  for (const e of entries) {
    if (e.metadata) {
      files.push(`${prefix}${e.name}`);
    } else {
      // It's a "folder" — recurse.
      await deleteStoragePrefix(admin, bucket, `${prefix}${e.name}/`);
    }
  }
  if (files.length > 0) {
    await admin.storage.from(bucket).remove(files);
  }
}
