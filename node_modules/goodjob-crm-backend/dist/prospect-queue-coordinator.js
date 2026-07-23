import { createHash } from "node:crypto";
function positiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
        ? Math.trunc(parsed)
        : fallback;
}
function errorCode(error) {
    if (typeof error === "object"
        && error !== null
        && "code" in error
        && typeof error.code === "string"
        && error.code) {
        return error.code.slice(0, 100);
    }
    return error instanceof Error
        ? error.name.slice(0, 100)
        : "PROSPECT_QUEUE_COORDINATION_FAILED";
}
function signalId(kind, agentJobId, attemptCount, nextAttemptAt) {
    const digest = createHash("sha256")
        .update(JSON.stringify({
        kind,
        agentJobId,
        attemptCount,
        nextAttemptAt
    }))
        .digest("hex");
    return `prospect-${kind}-${digest.slice(0, 48)}`;
}
export class ProspectQueueCoordinator {
    store;
    backend;
    onWake;
    now;
    syncIntervalMs;
    running = false;
    timer = null;
    syncPromise = null;
    statusValue;
    constructor(options) {
        this.store = options.store;
        this.backend = options.backend;
        this.onWake = options.onWake;
        this.now = options.now || (() => new Date());
        this.syncIntervalMs = Math.max(1_000, positiveInteger(options.syncIntervalMs, 5_000));
        this.statusValue = {
            mode: options.backend.mode,
            running: false,
            degraded: false,
            lastSyncAt: "",
            lastErrorCode: "",
            executionSignals: 0,
            deadLetterSignals: 0
        };
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.statusValue.running = true;
        try {
            await this.backend.start((signal, kind) => this.handleSignal(signal, kind));
            await this.synchronize();
            this.timer = setInterval(() => void this.synchronize(), this.syncIntervalMs);
            this.timer.unref();
        }
        catch (error) {
            this.running = false;
            this.statusValue.running = false;
            this.recordError(error);
            await this.backend.stop().catch(() => undefined);
            throw error;
        }
    }
    async stop() {
        this.running = false;
        this.statusValue.running = false;
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
        await this.syncPromise;
        this.syncPromise = null;
        await this.backend.stop();
    }
    status() {
        return { ...this.statusValue };
    }
    async synchronize() {
        if (!this.running)
            return;
        if (this.syncPromise)
            return this.syncPromise;
        this.syncPromise = this.performSynchronization()
            .finally(() => {
            this.syncPromise = null;
        });
        return this.syncPromise;
    }
    async performSynchronization() {
        await this.store.readBarrier();
        this.statusValue.degraded = false;
        this.statusValue.lastErrorCode = "";
        const now = this.now();
        const nowMs = now.getTime();
        const runs = new Map(this.store.prospectSearchRuns.map((item) => [
            `${item.teamId}\u001f${item.ownerId}\u001f${item.id}`,
            item
        ]));
        const shards = new Map(this.store.prospectRunShards.map((item) => [
            `${item.teamId}\u001f${item.runId}\u001f${item.id}`,
            item
        ]));
        const jobs = new Map(this.store.agentJobs.map((item) => [
            `${item.teamId}\u001f${item.ownerId}\u001f${item.id}`,
            item
        ]));
        let executionSignals = 0;
        let deadLetterSignals = 0;
        for (const binding of this.store.prospectRunQueueChildBindings) {
            const run = runs.get(`${binding.teamId}\u001f${binding.ownerId}\u001f${binding.runId}`);
            const shard = shards.get(`${binding.teamId}\u001f${binding.runId}\u001f${binding.shardId}`);
            const job = jobs.get(`${binding.teamId}\u001f${binding.ownerId}\u001f${binding.jobId}`);
            if (!run || !shard || !job)
                continue;
            if (job.status === "dead_letter") {
                const accepted = await this.enqueue("dead_letter", job.id, job.attemptCount, job.finishedAt || job.nextAttemptAt || job.createdAt, 0);
                if (accepted)
                    deadLetterSignals += 1;
                continue;
            }
            const executable = (run.status === "queued" || run.status === "running") && (shard.status === "queued" || shard.status === "retry_scheduled") && (job.status === "queued" || job.status === "retry_scheduled");
            if (!executable)
                continue;
            const dueAtMs = job.nextAttemptAt
                ? new Date(job.nextAttemptAt).getTime()
                : nowMs;
            const delayMs = Number.isFinite(dueAtMs)
                ? Math.max(0, dueAtMs - nowMs)
                : 0;
            const accepted = await this.enqueue("execution", job.id, job.attemptCount, job.nextAttemptAt, delayMs);
            if (accepted)
                executionSignals += 1;
        }
        this.statusValue.lastSyncAt = now.toISOString();
        this.statusValue.executionSignals = executionSignals;
        this.statusValue.deadLetterSignals = deadLetterSignals;
    }
    async enqueue(kind, agentJobId, attemptCount, nextAttemptAt, delayMs) {
        try {
            await this.backend.enqueue(kind, { agentJobId }, {
                signalId: signalId(kind, agentJobId, attemptCount, nextAttemptAt),
                delayMs
            });
            return true;
        }
        catch (error) {
            this.recordError(error);
            return false;
        }
    }
    async handleSignal(signal, kind) {
        if (!this.running || kind !== "execution")
            return;
        if (!signal
            || typeof signal.agentJobId !== "string"
            || !signal.agentJobId
            || signal.agentJobId.length > 160) {
            return;
        }
        const binding = this.store.prospectRunQueueChildBindings.find((item) => item.jobId === signal.agentJobId);
        if (!binding)
            return;
        const job = this.store.agentJobs.find((item) => item.id === signal.agentJobId
            && item.teamId === binding.teamId
            && item.ownerId === binding.ownerId
            && (item.status === "queued" || item.status === "retry_scheduled"));
        if (!job)
            return;
        await this.onWake(job.id);
    }
    recordError(error) {
        this.statusValue.degraded = true;
        this.statusValue.lastErrorCode = errorCode(error);
    }
}
