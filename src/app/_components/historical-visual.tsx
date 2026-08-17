import type { HistoricalVisual } from "@/lib/content/event-media";

export function HistoricalVisualFigure({
	className = "",
	imageClassName = "",
	captionClassName = "",
	showCaption = true,
	visual,
}: {
	className?: string;
	imageClassName?: string;
	captionClassName?: string;
	showCaption?: boolean;
	visual: HistoricalVisual;
}) {
	return (
		<figure className={className} data-historical-visual>
			{/* biome-ignore lint/performance/noImgElement: immutable curated asset needs framework-independent markup */}
			<img
				src={visual.src}
				width={visual.width}
				height={visual.height}
				alt={visual.alt}
				className={imageClassName}
				style={{ objectPosition: visual.focalPoint }}
			/>
			<figcaption
				className={`flex flex-wrap gap-x-5 gap-y-1 text-pretty text-xs leading-5 ${showCaption ? "justify-between" : "justify-end"} ${captionClassName}`}
			>
				{showCaption ? <span>{visual.caption}</span> : null}
				<span>
					{visual.credit} · {visual.license} ·{" "}
					<a
						href={visual.sourceUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex min-h-11 items-center underline decoration-current/50 underline-offset-4 hover:decoration-current"
					>
						Beeldbron
					</a>
				</span>
			</figcaption>
		</figure>
	);
}
