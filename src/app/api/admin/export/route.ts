import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { toCsv } from "@/lib/csv";
import { EXPORT_COLUMNS, exportRows } from "@/lib/repo/stats";

const query = z.object({
  type: z.enum(["participants", "questionnaire", "responses", "words"]),
  format: z.enum(["csv", "json"]).default("csv"),
});

/** GET /api/admin/export?type=responses&format=csv — anonymous IDs only, admin session required. */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { type, format } = parsed.data;
  const rows = await exportRows(type);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `manaviyat-${type}-${stamp}.${format}`;
  const body = format === "csv" ? toCsv(rows, EXPORT_COLUMNS[type]) : JSON.stringify(rows, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
