import { Queue, Worker } from "bullmq";
const EXECUTION_QUEUE_NAME = "goodjob-prospect-execution-v1";
const DEAD_LETTER_QUEUE_NAME = "goodjob-prospect-dead-letter-v1";
function withTimeout(operation, timeoutMs, code) {
    let timer = null;
    return Promise.race([
        operation,
        new Promise((_resolve, reject) => {
            timer = setTimeout(() => {
                const error = new Error("Redis/BullMQ 连接超时");
                Object.assign(error, { code });
                reject(error);
            }, timeoutMs);
        })
    ]).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
}
export function validateProspectRedisUrl(value) {
    const raw = value.trim();
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error("REDIS_URL 格式无效");
    }
    if (!["redis:", "rediss:"].includes(url.protocol)
        || !url.hostname
        || url.pathname.split("/").filter(Boolean).length > 1) {
        throw new Error("REDIS_URL 必须是有效的 redis:// 或 rediss:// 地址");
    }
    return raw;
}
function redisConnectionOptions(value, connectionTimeoutMs, worker) {
    const url = new URL(value);
    const databasePath = url.pathname.replace(/^\/+/, "");
    const database = databasePath ? Number(databasePath) : 0;
    if (!Number.isInteger(database) || database < 0) {
        throw new Error("REDIS_URL 数据库编号无效");
    }
    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        db: database,
        tls: url.protocol === "rediss:" ? {} : undefined,
        enableOfflineQueue: false,
        maxRetriesPerRequest: worker ? null : 1,
        connectTimeout: connectionTimeoutMs
    };
}
function validateSignal(signal) {
    if (!signal
        || typeof signal !== "object"
        || !("agentJobId" in signal)
        || typeof signal.agentJobId !== "string"
        || !signal.agentJobId
        || signal.agentJobId.length > 160
        || Object.keys(signal).some((key) => key !== "agentJobId")) {
        const error = new Error("BullMQ 获客协调信号格式无效");
        Object.assign(error, { code: "PROSPECT_QUEUE_SIGNAL_INVALID" });
        throw error;
    }
    return { agentJobId: signal.agentJobId };
}
export class BullMqProspectQueueBackend {
    mode = "bullmq";
    redisUrl;
    connectionTimeoutMs;
    executionQueue = null;
    deadLetterQueue = null;
    worker = null;
    constructor(options) {
        this.redisUrl = validateProspectRedisUrl(options.redisUrl);
        const timeout = Number(options.connectionTimeoutMs);
        this.connectionTimeoutMs = Number.isFinite(timeout) && timeout > 0
            ? Math.trunc(timeout)
            : 3_000;
    }
    async start(onSignal) {
        if (this.worker)
            return;
        const queueConnection = redisConnectionOptions(this.redisUrl, this.connectionTimeoutMs, false);
        const workerConnection = redisConnectionOptions(this.redisUrl, this.connectionTimeoutMs, true);
        try {
            this.executionQueue = new Queue(EXECUTION_QUEUE_NAME, {
                connection: queueConnection
            });
            this.deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, {
                connection: queueConnection
            });
            this.worker = new Worker(EXECUTION_QUEUE_NAME, async (job) => {
                await onSignal(validateSignal(job.data), "execution");
            }, {
                connection: workerConnection,
                concurrency: 1
            });
            this.worker.on("error", () => undefined);
            await withTimeout(Promise.all([
                this.executionQueue.waitUntilReady(),
                this.deadLetterQueue.waitUntilReady(),
                this.worker.waitUntilReady()
            ]), this.connectionTimeoutMs, "PROSPECT_BULLMQ_READY_TIMEOUT");
        }
        catch (error) {
            await this.stop().catch(() => undefined);
            throw error;
        }
    }
    async enqueue(kind, signal, options) {
        const queue = kind === "execution"
            ? this.executionQueue
            : this.deadLetterQueue;
        if (!queue) {
            const error = new Error("BullMQ 获客协调器尚未启动");
            Object.assign(error, { code: "PROSPECT_BULLMQ_NOT_READY" });
            throw error;
        }
        await queue.add(kind, validateSignal(signal), {
            jobId: options.signalId,
            delay: Math.max(0, Math.trunc(options.delayMs)),
            removeOnComplete: { age: 86_400, count: 10_000 },
            removeOnFail: { age: 604_800, count: 20_000 }
        });
    }
    async stop() {
        const worker = this.worker;
        const executionQueue = this.executionQueue;
        const deadLetterQueue = this.deadLetterQueue;
        this.worker = null;
        this.executionQueue = null;
        this.deadLetterQueue = null;
        await Promise.allSettled([
            worker?.close(),
            executionQueue?.close(),
            deadLetterQueue?.close()
        ]);
    }
}
