import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Moneta" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthForm mode="login" />;
}
