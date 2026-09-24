import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { BlogArticleView } from "@/components/blog/BlogArticleView";
import { getArticleForPreview } from "@/services/blog";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getArticleForPreview(id);
  if (!result) notFound();
  const { status } = result;

  return (
    <div>
      <div className="admin-card mb-6 flex flex-wrap items-center gap-3 p-3">
        <Link href="/admin/articles" className="admin-btn inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Artículos
        </Link>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
          Vista previa · {STATUS_LABEL[status] ?? status}
        </span>
        <span className="flex-1" />
        <Link
          href={`/admin/articles/${id}`}
          className="admin-btn admin-btn-primary inline-flex items-center gap-1.5"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar
        </Link>
      </div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white">
        <BlogArticleView post={result.post} products={result.products} />
      </div>
    </div>
  );
}
