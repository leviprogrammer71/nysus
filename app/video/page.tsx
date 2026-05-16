import { redirect } from "next/navigation";

/**
 * /video — legacy entry point. Now redirects to /projects/new.
 */
export default function VideoPage() {
  redirect("/projects/new");
}
