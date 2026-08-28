import { CarouselEditorClient } from "@/components/admin/CarouselEditorClient";

export default async function AdminEditCarouselPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarouselEditorClient projectId={id} />;
}
