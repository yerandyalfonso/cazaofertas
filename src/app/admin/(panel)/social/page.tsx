import { SocialCardListClient } from "@/components/admin/SocialCardListClient";
import { SocialRedesTabs } from "@/components/admin/SocialRedesTabs";

export default function AdminSocialPage() {
  return (
    <div>
      <SocialRedesTabs active="cards" />
      <SocialCardListClient />
    </div>
  );
}
