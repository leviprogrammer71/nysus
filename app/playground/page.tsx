import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { PlaygroundClient } from "./playground-client";

export const dynamic = "force-dynamic";

/**
 * The Playground — the threshold.
 *
 * Project-less generation. The user picks any image or animation
 * model from the registry, gives a prompt, optionally drops a source
 * image, and runs the forge directly. No bible. No procession. No
 * cast. Just the hammer and the anvil.
 */
export default async function PlaygroundPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    redirect("/login");
  }
  return <PlaygroundClient />;
}
