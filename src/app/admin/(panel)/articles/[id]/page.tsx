import { ArticleFormClient } from "@/components/admin/ArticleFormClient";

export default async function AdminEditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArticleFormClient articleId={id} />;
}
