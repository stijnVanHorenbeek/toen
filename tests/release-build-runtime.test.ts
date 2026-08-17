import { describe, expect, it, vi } from "vitest";
import {
	createReleaseBuildReceipt,
	parseReleaseBuildReceipt,
	resolveReleaseActivationLockForBuild,
	resolveReleaseRequestForBuild,
} from "../src/lib/release/release-build-runtime";
import { createReleaseActivationLock } from "../src/lib/release/release-lock";
import { createReleaseRequest } from "../src/lib/release/release-request";

const buildUuid = "123e4567-e89b-42d3-a456-426614174000";
const appSha = "a".repeat(40);
const contentSha = "b".repeat(40);

describe("release build runtime", () => {
	it("waits for immutable build correlation and verifies exact application SHA", async () => {
		const request = createReleaseRequest({ appSha, buildUuid, contentSha });
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(
				new Response(`${JSON.stringify(request)}\n`, { status: 200 }),
			);
		const delay = vi.fn().mockResolvedValue(undefined);
		await expect(
			resolveReleaseRequestForBuild({
				applicationSha: appSha,
				buildUuid,
				contentRepository: "owner/toen-content",
				contentBranch: "main",
				fetch,
				delay,
				attempts: 2,
			}),
		).resolves.toEqual(request);
		expect(delay).toHaveBeenCalledOnce();
		expect(fetch.mock.calls[0]?.[0]).toContain(
			`.toen/releases/requests/${buildUuid}.json`,
		);
	});

	it("rejects streamed release requests above bounded read", async () => {
		await expect(
			resolveReleaseRequestForBuild({
				applicationSha: appSha,
				buildUuid,
				contentRepository: "owner/toen-content",
				contentBranch: "main",
				fetch: vi
					.fn()
					.mockResolvedValue(new Response("x".repeat(4_097), { status: 200 })),
				delay: vi.fn(),
				attempts: 1,
			}),
		).rejects.toThrow("exceeds 4096 bytes");
	});

	it("rejects cross-wired application revisions", async () => {
		const request = createReleaseRequest({ appSha, buildUuid, contentSha });
		await expect(
			resolveReleaseRequestForBuild({
				applicationSha: "c".repeat(40),
				buildUuid,
				contentRepository: "owner/toen-content",
				contentBranch: "main",
				fetch: vi
					.fn()
					.mockResolvedValue(
						new Response(JSON.stringify(request), { status: 200 }),
					),
				delay: vi.fn(),
				attempts: 1,
			}),
		).rejects.toThrow("application SHA");
	});

	it("requires active Git lock ownership before activation", async () => {
		const lock = createReleaseActivationLock({
			state: "active",
			ownerId: "223e4567-e89b-42d3-a456-426614174000",
			appSha,
			contentSha,
			buildUuid,
		});
		await expect(
			resolveReleaseActivationLockForBuild({
				applicationSha: appSha,
				buildUuid,
				contentRepository: "owner/toen-content",
				contentBranch: "main",
				fetch: vi
					.fn()
					.mockResolvedValue(
						new Response(JSON.stringify(lock), { status: 200 }),
					),
			}),
		).resolves.toEqual(lock);
	});

	it("hashes final build receipt", () => {
		const receipt = createReleaseBuildReceipt({
			request: createReleaseRequest({ appSha, buildUuid, contentSha }),
			releaseId: "d".repeat(64),
			staticFileCount: 52,
			staticTreeSha256: "e".repeat(64),
			adminWorkerSha256: "f".repeat(64),
		});
		expect(parseReleaseBuildReceipt(JSON.stringify(receipt))).toEqual(receipt);
		expect(() =>
			parseReleaseBuildReceipt(
				JSON.stringify({ ...receipt, staticFileCount: 53 }),
			),
		).toThrow("integrity");
	});
});
