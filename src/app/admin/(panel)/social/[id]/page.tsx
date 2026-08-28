import { SocialAdminClient } from "@/components/admin/SocialAdminClient";

export default async function AdminEditSocialCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SocialAdminClient projectId={id} />;
}
