import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TopStrip } from "@/components/TopStrip";
import { TopicsNav } from "@/components/TopicsNav";
import { UmamiScript } from "@/components/UmamiScript";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopStrip />
      <Header />
      <TopicsNav />
      <main className="flex-1">{children}</main>
      <Footer />
      <UmamiScript />
    </>
  );
}
