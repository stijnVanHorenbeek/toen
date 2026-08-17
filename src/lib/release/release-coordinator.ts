import type { GitHubRepository } from "../github/github-repository";
import type { CloudflareBuildsClient } from "./cloudflare-builds";
import {
	acquireReleaseActivationLock,
	activateReleaseLock,
	releaseLock,
} from "./release-lock";
import {
	createReleaseRequest,
	releaseRequestPath,
	serializeReleaseRequest,
} from "./release-request";

export async function coordinateLockedExactRelease({
	appSha,
	builds,
	contentSha,
	repository,
}: {
	appSha: string;
	builds: CloudflareBuildsClient;
	contentSha: string;
	repository: GitHubRepository;
}): Promise<
	| {
			status: "building";
			buildUuid: string;
			releaseRequestCommitSha: string;
	  }
	| {
			status: "committed";
			reason:
				| "build-in-progress"
				| "build-trigger-failed"
				| "release-lock-failed"
				| "release-request-failed";
			buildUuid?: string;
	  }
> {
	let lease: Awaited<ReturnType<typeof acquireReleaseActivationLock>>;
	try {
		lease = await acquireReleaseActivationLock({
			appSha,
			builds,
			contentSha,
			repository,
		});
	} catch {
		return { status: "committed", reason: "release-lock-failed" };
	}
	if (!lease) return { status: "committed", reason: "build-in-progress" };
	let buildUuid: string;
	try {
		buildUuid = (await builds.trigger()).buildUuid;
	} catch {
		await releaseLock({ lease, repository }).catch(() => undefined);
		return { status: "committed", reason: "build-trigger-failed" };
	}
	try {
		await activateReleaseLock({ buildUuid, lease, repository });
	} catch {
		return { status: "committed", reason: "release-lock-failed", buildUuid };
	}
	const request = createReleaseRequest({ appSha, buildUuid, contentSha });
	try {
		const written = await repository.upsertFile({
			content: serializeReleaseRequest(request),
			message: `chore(release): correlate build ${buildUuid}`,
			path: releaseRequestPath(buildUuid),
		});
		return {
			status: "building",
			buildUuid,
			releaseRequestCommitSha: written.commitSha,
		};
	} catch {
		return {
			status: "committed",
			reason: "release-request-failed",
			buildUuid,
		};
	}
}

type WriteReleaseRequest = (input: {
	content: string;
	message: string;
	path: string;
}) => Promise<{ change: "created" | "unchanged"; commitSha: string }>;

export async function coordinateExactRelease({
	appSha,
	contentSha,
	trigger,
	writeReleaseRequest,
}: {
	appSha: string;
	contentSha: string;
	trigger: () => Promise<{ buildUuid: string }>;
	writeReleaseRequest: WriteReleaseRequest;
}): Promise<
	| {
			status: "building";
			buildUuid: string;
			releaseRequestCommitSha: string;
	  }
	| {
			status: "committed";
			reason: "build-trigger-failed" | "release-request-failed";
			buildUuid?: string;
	  }
> {
	let buildUuid: string;
	try {
		buildUuid = (await trigger()).buildUuid;
	} catch {
		return { status: "committed", reason: "build-trigger-failed" };
	}
	const request = createReleaseRequest({ appSha, buildUuid, contentSha });
	try {
		const written = await writeReleaseRequest({
			content: serializeReleaseRequest(request),
			message: `chore(release): correlate build ${buildUuid}`,
			path: releaseRequestPath(buildUuid),
		});
		return {
			status: "building",
			buildUuid,
			releaseRequestCommitSha: written.commitSha,
		};
	} catch {
		return {
			status: "committed",
			reason: "release-request-failed",
			buildUuid,
		};
	}
}
