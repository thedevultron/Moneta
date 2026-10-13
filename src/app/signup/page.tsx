import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account — Moneta" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthForm mode="signup" />;
}
