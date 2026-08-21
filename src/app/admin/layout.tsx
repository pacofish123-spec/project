import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireCapability } from "@/lib/authorization";
import { AppHeader } from "@/components/app-header";
import { AdminTabs } from "@/components/admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireCapability("can_manage_platform");
  } catch {
    redirect("/");
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-ocean">
        <div className="page-width">
          <p className="admin-area-kicker"><ShieldCheck size={14} /> yoRento Admin</p>
          <AdminTabs />
          {children}
        </div>
      </main>
    </>
  );
}
