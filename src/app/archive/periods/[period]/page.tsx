import { notFound } from "next/navigation";
import { EventArchiveList } from "@/app/_components/event-archive-list";
import { EventArchiveShell } from "@/app/_components/event-archive-shell";
import { getArchiveEventCatalog } from "@/lib/content/event-archive-loader";
import { createPeriodArchives } from "@/lib/content/event-archives";
import { historicalDateMessages } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";

type PeriodArchivePageProps = { params: Promise<{ period: string }> };

export async function generateStaticParams() {
	return createPeriodArchives(await getArchiveEventCatalog()).map(({ id }) => ({
		period: id,
	}));
}

export default async function PeriodArchivePage({
	params,
}: PeriodArchivePageProps) {
	const { period: periodId } = await params;
	const period = createPeriodArchives(await getArchiveEventCatalog()).find(
		({ id }) => id === periodId,
	);
	if (!period) notFound();
	const title = messages.archive.periodTitle
		.replace("{minimum}", formatSignedYear(period.minimumYear))
		.replace("{maximum}", formatSignedYear(period.maximumYear));
	return (
		<EventArchiveShell title={title}>
			<EventArchiveList events={period.events} />
		</EventArchiveShell>
	);
}

function formatSignedYear(year: number): string {
	return year < 0
		? `${Math.abs(year)} ${historicalDateMessages.beforeCommonEra}`
		: `${year} ${historicalDateMessages.afterCommonEra}`;
}
