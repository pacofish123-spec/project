import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireCapability } from "@/lib/authorization";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminTabs } from "@/components/admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireCapability("can_manage_platform");
  } catch {
    redirect("/");
  }

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav">
          <Link className="workflow-back" href="/"><ShieldCheck size={16} /> yoRento Admin</Link>
          <ThemeToggle />
        </div>
        <AdminTabs />
        {children}
      </div>
    </main>
  );
}
