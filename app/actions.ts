"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { projectInputSchema } from "@/lib/projects";
import { templateBySlug } from "@/lib/templates";

type ActionState = { ok: boolean; message: string };

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join(". "),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const templateSlug = formData.get("template");
  const template =
    typeof templateSlug === "string" ? templateBySlug(templateSlug) : null;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      character_sheet: template?.character_sheet ?? {},
      aesthetic_bible: template?.aesthetic_bible ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create project." };
  }

  revalidatePath("/");
  redirect(`/projects/${data.id}`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    // RLS will drop this if the user isn't the owner; we simply ignore
    // and let the UI refresh with whatever the server returns.
    console.error("deleteProject:", error.message);
  }

  revalidatePath("/");
}
