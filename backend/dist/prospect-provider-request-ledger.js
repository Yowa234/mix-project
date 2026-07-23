import { createHash, createHmac } from "node:crypto";
import { canonicalJsonStringify } from "./canonical-json.js";
export const PROSPECT_PROVIDER_REQUEST_LEDGER_CONTRACT = "provider_request_ledger_v1";
const ledgerTransitions = {
    prepared: new Set(["dispatch_started", "settled"]),
    dispatch_started: new Set([
        "dispatch_confirmed",
        "response_received",
        "outcome_unknown"
    ]),
    dispatch_confirmed: new Set([
        "response_received",
        "outcome_unknown"
    ]),
    response_received: new Set(["settled", "cancelled_late"]),
    outcome_unknown: new Set([
        "dispatch_started",
        "dispatch_confirmed",
        "response_received",
        "cancelled_late"
    ]),
    settled: new Set(),
    cancelled_late: new Set()
};
const dispatchTransitions = {
    started: new Set([
        "confirmed",
        "response_received",
        "outcome_unknown",
        "rejected"
    ]),
    confirmed: new Set(["response_received", "outcome_unknown"]),
    outcome_unknown: new Set(["confirmed", "response_received"]),
    response_received: new Set(),
    rejected: new Set()
};
export function sha256CanonicalJson(value) {
    return createHash("sha256")
        .update(canonicalJsonStringify(value))
        .digest("hex");
}
export function prospectProviderRequestHash(input) {
    return sha256CanonicalJson({
        contractVersion: input.contractVersion,
        requestSchemaVersion: input.requestSchemaVersion,
        adapterVersion: input.adapterVersion,
        teamId: input.teamId,
        ownerId: input.ownerId,
        runId: input.runId,
        shardId: input.shardId,
        checkpointNo: input.checkpointNo,
        logicalRequestNo: input.logicalRequestNo,
        providerCode: input.providerCode,
        connectionId: input.connectionId,
        connectionRevision: input.connectionRevision,
        endpointCode: input.endpointCode,
        providerPayload: input.providerPayload
    });
}
export function prospectProviderRequestIdempotencyKey(input, secret) {
    if (secret.length < 32) {
        throw new Error("Provider 请求幂等密钥至少需要 32 个字符");
    }
    return createHmac("sha256", secret)
        .update([
        PROSPECT_PROVIDER_REQUEST_LEDGER_CONTRACT,
        input.teamId,
        input.ownerId,
        input.connectionId,
        input.endpointCode,
        input.requestHash
    ].join("\u001f"))
        .digest("hex");
}
export function prospectProviderResponseHash(input) {
    return sha256CanonicalJson(input);
}
export function prospectProviderResponseComponentHashes(step) {
    return {
        rawResponseHash: sha256CanonicalJson({ step }),
        normalizedResultHash: sha256CanonicalJson(step),
        accountingEvidenceHash: prospectProviderAccountingEvidenceHash(step)
    };
}
export function prospectProviderAccountingEvidenceHash(step) {
    return sha256CanonicalJson({
        usage: step.usage,
        cost: step.cost
    });
}
export function prospectProviderAccountingEvidenceRef(input) {
    return `sha256:${sha256CanonicalJson({
        contract: PROSPECT_PROVIDER_REQUEST_LEDGER_CONTRACT,
        evidenceVersion: "provider-accounting-evidence-v1",
        ...input
    })}`;
}
export function prospectProviderSettlementHash(input) {
    return sha256CanonicalJson({
        contract: PROSPECT_PROVIDER_REQUEST_LEDGER_CONTRACT,
        settlementVersion: "provider-response-settlement-v1",
        ...input
    });
}
export function prospectProviderDispatchConfirmationRef(input) {
    return `sha256:${sha256CanonicalJson(input)}`;
}
export function prospectProviderResponseEvidenceRef(input) {
    return `sha256:${sha256CanonicalJson({
        contract: PROSPECT_PROVIDER_REQUEST_LEDGER_CONTRACT,
        envelopeVersion: "provider-response-v1",
        ...input
    })}`;
}
export function isProspectProviderRequestTransitionAllowed(fromStatus, toStatus) {
    return ledgerTransitions[fromStatus].has(toStatus);
}
export function isProspectProviderDispatchTransitionAllowed(fromStatus, toStatus) {
    return dispatchTransitions[fromStatus].has(toStatus);
}
export function hasValidProspectProviderDispatchStatusFacts(dispatch) {
    if (dispatch.status === "started") {
        return !dispatch.finishedAt
            && !dispatch.confirmedAt
            && !dispatch.externalRequestId
            && !dispatch.responseHash
            && !dispatch.errorCode
            && !dispatch.replayed
            && !dispatch.providerExecuted;
    }
    if (dispatch.status === "confirmed") {
        return Boolean(dispatch.confirmedAt)
            && Boolean(dispatch.externalRequestId)
            && !dispatch.finishedAt
            && !dispatch.responseHash
            && !dispatch.errorCode;
    }
    if (dispatch.status === "response_received") {
        return Boolean(dispatch.finishedAt)
            && Boolean(dispatch.responseHash);
    }
    if (dispatch.status === "outcome_unknown") {
        return Boolean(dispatch.finishedAt)
            && Boolean(dispatch.errorCode)
            && !dispatch.responseHash;
    }
    return Boolean(dispatch.finishedAt)
        && Boolean(dispatch.errorCode)
        && !dispatch.providerExecuted
        && !dispatch.responseHash;
}
