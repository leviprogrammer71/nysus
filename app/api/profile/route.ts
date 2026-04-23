import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    display_name: z.string().trim().max(80).nullable().optional(),
    handle: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9_-]+$/i, "Handles are letters, digits, _ and -.")
      .nullable()
      .optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    website: z
      .string()
      .trim()
      .max(200)
      .url()
      .nullable()
      .optional(),
    avatar_path: z.string().trim().max(400).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    profile: data ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // Normalize handle to lowercase.
  const handle = body.handle ? body.handle.toLowerCase() : body.handle;

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      ...(body.display_name !== undefined
        ? { display_name: body.display_name }
        : {}),
      ...(handle !== undefined ? { handle } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
      ...(body.avatar_path !== undefined
        ? { avatar_path: body.avatar_path }
        : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That handle is already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
