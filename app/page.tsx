import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";

/** Send each visitor to the right place: login, or their role's home page. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user.role) : "/auth/login");
}
