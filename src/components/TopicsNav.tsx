import { Suspense } from "react";
import { TopicsNavClient } from "@/components/TopicsNavClient";
import { TopicsNavView } from "@/components/TopicsNavView";
import { getBlogTopics } from "@/services/blog";

export async function TopicsNav() {
  const topics = await getBlogTopics();
  if (topics.length === 0) return null;
  return (
    <Suspense fallback={<TopicsNavView topics={topics} active={null} />}>
      <TopicsNavClient topics={topics} />
    </Suspense>
  );
}
