import { VideosAdminClient } from "@/components/admin/VideosAdminClient";

export default async function AdminVideosEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideosAdminClient projectId={id} />;
}
