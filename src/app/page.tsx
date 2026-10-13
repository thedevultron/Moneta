import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { PublicLiveButton } from "@/components/app/GlobalLiveDock";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);
  // Signed-in users always land on the dashboard — even via / or /app links.
  if (user) redirect("/app");
  return (
    <>
      <Landing loggedIn={false} />
      <PublicLiveButton />
    </>
  );
}
