import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isAdmin } from "@/lib/admin-auth";
import { AdminNav } from "./admin-nav";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("title"), robots: { index: false, follow: false } };
}

/**
 * The admin area is exactly one viewport tall at every size; long tables scroll
 * inside their own panels. (7.5rem = header + two-line footer on phones.)
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-6xl flex-col px-3 pb-2 sm:h-[calc(100dvh-6.25rem)] sm:px-6">
      {authed ? (
        <>
          <AdminNav />
          <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <LoginForm />
        </div>
      )}
    </div>
  );
}
