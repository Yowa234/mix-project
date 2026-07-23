import { createHash } from "node:crypto";
import { decryptProviderResponseCachePayload, encryptProviderResponseCachePayload } from "./credential-security.js";
import { getStore } from "./store.js";
const FORBIDDEN_CONTEXT_KEYS = /^(tenant|tenantId|team|teamId|owner|ownerId|campaign|campaignId|run|runId|runShardId|purpose|keywords?|productKeywords)$/i;
function cacheId(key) {
    const digest = createHash("sha256")
        .update([
        key.providerId,
        key.providerVersion,
        key.requestFingerprint,
        key.licenseScope
    ].join("|"))
        .digest("hex");
    return `prc_${digest.slice(0, 48)}`;
}
function payloadHash(payload) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function assertNeutralPublicPayload(value, path = "$") {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNeutralPublicPayload(item, `${path}[${index}]`));
        return;
    }
    if (!value || typeof value !== "object")
        return;
    for (const [key, item] of Object.entries(value)) {
        if (FORBIDDEN_CONTEXT_KEYS.test(key)) {
            throw new Error(`Provider 公共缓存禁止保存租户业务上下文字段：${path}.${key}`);
        }
        assertNeutralPublicPayload(item, `${path}.${key}`);
    }
}
function sameKey(entry, key) {
    return entry.providerId === key.providerId
        && entry.providerVersion === key.providerVersion
        && entry.requestFingerprint === key.requestFingerprint
        && entry.licenseScope === key.licenseScope;
}
function encryptionContext(entry) {
    return {
        id: entry.id,
        providerId: entry.providerId,
        providerVersion: entry.providerVersion,
        requestFingerprint: entry.requestFingerprint,
        licenseScope: entry.licenseScope
    };
}
export async function readProviderResponseCache(key, now = new Date()) {
    const entry = getStore().providerResponseCache.find((item) => item.status === "active" && sameKey(item, key));
    if (!entry || entry.licenseScope !== key.licenseScope)
        return null;
    if (new Date(entry.expiresAt).getTime() <= now.getTime())
        return null;
    try {
        const payload = decryptProviderResponseCachePayload(encryptionContext(entry), entry.payloadEncrypted);
        assertNeutralPublicPayload(payload);
        if (payloadHash(payload) !== entry.payloadHash)
            throw new Error("Provider 响应缓存摘要不匹配");
        return {
            payload: payload,
            fetchedAt: entry.fetchedAt,
            expiresAt: entry.expiresAt
        };
    }
    catch {
        entry.status = "invalid";
        await getStore().persist();
        return null;
    }
}
export async function writeProviderResponseCache(key, payload, options) {
    assertNeutralPublicPayload(payload);
    const fetchedAt = options.fetchedAt || new Date().toISOString();
    if (new Date(options.expiresAt).getTime() <= new Date(fetchedAt).getTime()) {
        throw new Error("Provider 响应缓存过期时间必须晚于抓取时间");
    }
    const store = getStore();
    const existing = store.providerResponseCache.find((item) => sameKey(item, key));
    const entry = {
        id: existing?.id || cacheId(key),
        providerId: key.providerId,
        providerVersion: key.providerVersion,
        requestFingerprint: key.requestFingerprint,
        payloadEncrypted: "",
        payloadHash: payloadHash(payload),
        fetchedAt,
        expiresAt: options.expiresAt,
        licenseScope: key.licenseScope,
        status: "active"
    };
    entry.payloadEncrypted = encryptProviderResponseCachePayload(encryptionContext(entry), payload);
    if (existing)
        Object.assign(existing, entry);
    else
        store.providerResponseCache.push(entry);
    await store.persist();
    return {
        id: entry.id,
        providerId: entry.providerId,
        providerVersion: entry.providerVersion,
        requestFingerprint: entry.requestFingerprint,
        payloadHash: entry.payloadHash,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
        licenseScope: entry.licenseScope,
        status: entry.status
    };
}
