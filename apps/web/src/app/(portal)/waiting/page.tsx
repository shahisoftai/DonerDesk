import type { Metadata } from "next";
import { getTranslator } from "@/lib/server/locale";
import { WaitingList } from "@/features/record/presentation/WaitingList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Waiting to send" };

/** Everything recorded on this phone and not yet sent, in one list. The data is the phone's own outbox, so it is the same offline. */
export default async function WaitingPage() {
  const { t } = await getTranslator();
  return (
    <div className="animate-fade-in max-w-xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t("record.waiting.title")}</h1>
      <WaitingList />
    </div>
  );
}
