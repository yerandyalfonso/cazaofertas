import { VideoListClient } from "@/components/admin/VideoListClient";
import { SocialRedesTabs } from "@/components/admin/SocialRedesTabs";

export default function AdminVideosPage() {
  return (
    <div>
      <SocialRedesTabs active="videos" />
      <VideoListClient />
    </div>
  );
}
