import { notFound } from "next/navigation";
import { EventArchiveList } from "@/app/_components/event-archive-list";
import { EventArchiveShell } from "@/app/_components/event-archive-shell";
import { getArchiveEventCatalog } from "@/lib/content/event-archive-loader";
import { createTopicArchives } from "@/lib/content/event-archives";
import { messages } from "@/lib/i18n/messages.nl-BE";

type TopicArchivePageProps = { params: Promise<{ topic: string }> };

export async function generateStaticParams() {
	return createTopicArchives(await getArchiveEventCatalog()).map(({ id }) => ({
		topic: id,
	}));
}

export default async function TopicArchivePage({
	params,
}: TopicArchivePageProps) {
	const { topic: topicId } = await params;
	const topic = createTopicArchives(await getArchiveEventCatalog()).find(
		({ id }) => id === topicId,
	);
	if (!topic) notFound();
	return (
		<EventArchiveShell
			title={messages.archive.topicTitle.replace("{topic}", topic.label)}
		>
			<EventArchiveList events={topic.events} />
		</EventArchiveShell>
	);
}
