import { ArticlesAdminClient } from "@/components/admin/ArticlesAdminClient";

const STATUSES = ["draft", "published", "archived"] as const;

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initialStatus = STATUSES.find((value) => value === status) ?? "all";
  return <ArticlesAdminClient initialStatus={initialStatus} />;
}
