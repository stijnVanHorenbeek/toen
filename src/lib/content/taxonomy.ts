export const vakrichtingIds = [
	"algemeen",
	"auto-mechanica",
	"elektriciteit",
	"bouw",
	"hout",
	"metaal",
	"logistiek-transport",
] as const;

export type VakrichtingId = (typeof vakrichtingIds)[number];
