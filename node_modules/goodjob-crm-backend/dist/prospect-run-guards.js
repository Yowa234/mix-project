import { randomUUID } from "node:crypto";
import { validateProspectRunQueueBridge } from "./prospect-run-queue-bridge.js";
const ACTIVE_RUN_STATUSES = new Set([
    "queued",
    "running",
    "pause_requested",
    "paused",
    "cancel_requested"
]);
export function isActiveProspectRun(run) {
    return ACTIVE_RUN_STATUSES.has(run.status);
}
export function activeProspectRunsForCampaign(store, teamId, campaignId) {
    return store.prospectSearchRuns.filter((run) => run.teamId === teamId
        && run.campaignId === campaignId
        && isActiveProspectRun(run));
}
export function activeProspectRunsForStrategy(store, teamId, strategyId) {
    return store.prospectSearchRuns.filter((run) => run.teamId === teamId
        && run.strategyId === strategyId
        && isActiveProspectRun(run));
}
export function activeProspectRunsForOwner(store, teamId, ownerId) {
    return store.prospectSearchRuns.filter((run) => run.teamId === teamId
        && run.ownerId === ownerId
        && isActiveProspectRun(run));
}
function nextEventSequence(store, run) {
    return store.prospectRunEvents.reduce((highest, event) => event.teamId === run.teamId && event.runId === run.id
        ? Math.max(highest, event.sequence)
        : highest, 0) + 1;
}
function runEvent(input) {
    return {
        id: `pre_${randomUUID()}`,
        teamId: input.run.teamId,
        runId: input.run.id,
        sequence: nextEventSequence(input.store, input.run),
        eventType: "paused",
        actorId: input.actorId,
        requestId: input.requestId,
        fromStatus: input.fromStatus,
        toStatus: "paused",
        fromRevision: input.fromRevision,
        toRevision: input.run.revision,
        reason: input.reason,
        createdAt: input.run.updatedAt
    };
}
export function pauseQueuedProspectRunsForCampaign(input) {
    const now = input.now || new Date().toISOString();
    const queuedRuns = input.store.prospectSearchRuns.filter((run) => run.teamId === input.teamId
        && run.campaignId === input.campaignId
        && run.status === "queued");
    queuedRuns.forEach((run) => validateProspectRunQueueBridge(input.store, run));
    for (const run of queuedRuns) {
        const previousStatus = run.status;
        const previousRevision = run.revision;
        run.status = "paused";
        run.revision += 1;
        run.pausedAt = now;
        run.updatedAt = now;
        for (const shard of input.store.prospectRunShards) {
            if (shard.teamId !== run.teamId || shard.runId !== run.id)
                continue;
            if (shard.status === "queued") {
                shard.status = "paused";
                shard.updatedAt = now;
            }
        }
        input.store.prospectRunEvents.push(runEvent({
            store: input.store,
            run,
            actorId: input.actorId,
            requestId: input.requestId,
            fromStatus: previousStatus,
            fromRevision: previousRevision,
            reason: input.reason
        }));
    }
    return queuedRuns;
}
