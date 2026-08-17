import { cache } from "react";
import { toEventCatalogEntry } from "./event-catalog";
import { getAllEvents } from "./events";

export const getArchiveEventCatalog = cache(async () =>
	(await getAllEvents()).map(toEventCatalogEntry),
);
