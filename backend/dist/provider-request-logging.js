import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
const providerRequestStorage = new AsyncLocalStorage();
function stableValue(value) {
    if (Array.isArray(value))
        return value.map(stableValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stableValue(item)]));
    }
    return value;
}
export function providerRequestFingerprint(value) {
    const secret = process.env.PROVIDER_CREDENTIAL_KEY
        || process.env.JWT_SECRET
        || process.env.DATABASE_URL
        || process.env.MYSQL_URL
        || "goodjob-provider-request-fingerprint-development";
    return createHmac("sha256", secret)
        .update(JSON.stringify(stableValue(value)))
        .digest("hex");
}
export async function withProviderRequestLogging(context, operation, onLogs) {
    const state = { ...context, logs: [] };
    try {
        return await providerRequestStorage.run(state, operation);
    }
    finally {
        if (state.logs.length)
            onLogs(state.logs);
    }
}
export function recordProviderHttpResult(result) {
    const state = providerRequestStorage.getStore();
    if (!state)
        return;
    state.logs.push({
        id: `prl_${randomUUID()}`,
        teamId: state.teamId,
        ownerId: state.ownerId,
        providerId: state.providerId,
        connectionId: state.connectionId,
        runId: state.runId,
        runShardId: state.runShardId,
        requestFingerprint: state.requestFingerprint,
        endpointCode: state.endpointCode,
        httpStatus: Math.max(0, Math.trunc(result.httpStatus)),
        attempt: 1,
        quotaUnits: Math.max(0, result.quotaUnits ?? 1),
        costAmount: 0,
        currency: "",
        durationMs: Math.max(0, Math.trunc(result.durationMs)),
        responseSize: Math.max(0, Math.trunc(result.responseSize)),
        errorCode: result.errorCode.slice(0, 80),
        requestedAt: result.requestedAt
    });
}
export function recordProviderHttpResultIfEmpty(result) {
    const state = providerRequestStorage.getStore();
    if (!state || state.logs.length)
        return;
    recordProviderHttpResult(result);
}
export function recordProviderCacheHit(requestedAt = new Date().toISOString()) {
    recordProviderHttpResult({
        httpStatus: 200,
        durationMs: 0,
        responseSize: 0,
        errorCode: "",
        requestedAt,
        quotaUnits: 0
    });
}
