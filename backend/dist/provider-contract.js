import { createHash } from "node:crypto";
import { z } from "zod";
import { isForbiddenNetworkHostname } from "./provider-network-security.js";
export const PROVIDER_CONTRACT_VERSION = "1.0";
export class ProviderContractError extends Error {
    code;
    retryable;
    retryAfterAt;
    publicMessage;
    httpStatus;
    phase;
    constructor(shape, options) {
        super(shape.publicMessage, options);
        this.name = "ProviderContractError";
        this.code = shape.code;
        this.retryable = shape.retryable;
        this.retryAfterAt = shape.retryAfterAt;
        this.publicMessage = shape.publicMessage;
        this.httpStatus = shape.httpStatus;
        this.phase = shape.phase;
    }
}
export class ProviderHttpStatusError extends Error {
    httpStatus;
    retryAfterAt;
    constructor(httpStatus, retryAfterAt, providerLabel) {
        super(`${providerLabel} HTTP ${httpStatus}`);
        this.name = "ProviderHttpStatusError";
        this.httpStatus = httpStatus;
        this.retryAfterAt = retryAfterAt;
    }
}
function retryAfterAt(response) {
    const value = response.headers.get("retry-after")?.trim();
    if (!value)
        return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return new Date(Date.now() + seconds * 1000).toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function providerHttpStatusError(response, providerLabel = "Provider") {
    return new ProviderHttpStatusError(response.status, retryAfterAt(response), providerLabel);
}
const normalizedQuerySchema = z.object({
    goal: z.string().max(500),
    productKeywords: z.array(z.string().min(1).max(120)).max(40),
    countries: z.array(z.string().min(1).max(80)).max(30),
    industries: z.array(z.string().min(1).max(120)).max(30),
    customerTypes: z.array(z.string().min(1).max(80)).max(20),
    excludeKeywords: z.array(z.string().min(1).max(120)).max(40),
    limit: z.number().int().min(1).max(30)
}).strict();
const normalizedTradeQuerySchema = z.object({
    reporterCodes: z.array(z.string().regex(/^\d{1,4}$/)).min(1).max(20),
    partnerCodes: z.array(z.string().regex(/^\d{1,4}$/)).min(1).max(20),
    flow: z.enum(["import", "export"]),
    hsVersion: z.enum(["HS", "HS2017", "HS2022"]),
    commodityCodes: z.array(z.string().regex(/^\d{2,6}$/)).min(1).max(50),
    periods: z.array(z.string().regex(/^\d{4}(?:\d{2})?$/)).min(1).max(36),
    frequency: z.enum(["annual", "monthly"]),
    limit: z.number().int().min(1).max(500)
}).strict().superRefine((value, context) => {
    const expectedLength = value.frequency === "annual" ? 4 : 6;
    value.periods.forEach((period, index) => {
        if (period.length !== expectedLength) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["periods", index],
                message: value.frequency === "annual" ? "Annual period must use YYYY" : "Monthly period must use YYYYMM"
            });
        }
        if (value.frequency === "monthly"
            && period.length === 6
            && !/^(?:0[1-9]|1[0-2])$/.test(period.slice(4))) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["periods", index],
                message: "Monthly period month must be between 01 and 12"
            });
        }
    });
});
const recordTypeSchema = z.enum([
    "company_candidate",
    "identity_evidence",
    "contact_evidence",
    "business_signal",
    "discovery_page",
    "assisted_suggestion"
]);
const adapterPageSchema = z.object({
    records: z.array(z.object({
        company: z.string().max(200),
        website: z.string().max(500).optional(),
        officialWebsite: z.string().max(500).optional(),
        country: z.string().max(100).optional(),
        business: z.string().max(500).optional(),
        contact: z.string().max(160).optional(),
        contactInfo: z.string().max(255).optional(),
        description: z.string().max(2000).optional(),
        confidence: z.number().min(0).max(100).optional(),
        providerRecordId: z.string().max(255).optional(),
        sourceUrl: z.string().max(1000).optional(),
        recordType: recordTypeSchema.optional(),
        evidenceSummary: z.string().max(1000).optional(),
        matchedFields: z.array(z.string().max(80)).max(30).optional()
    }).strict()).max(100),
    nextCursor: z.string().max(2000).nullable().optional(),
    exhausted: z.boolean().optional(),
    rawCount: z.number().int().min(0).max(100000).optional(),
    invalidCount: z.number().int().min(0).max(100000).optional(),
    warnings: z.array(z.string().max(300)).max(50).optional(),
    usage: z.object({
        requestCount: z.number().int().min(0).nullable().optional(),
        quotaUsed: z.number().min(0).nullable().optional(),
        quotaRemaining: z.number().min(0).nullable().optional(),
        costAmount: z.number().min(0).nullable().optional(),
        currency: z.string().max(12).nullable().optional(),
        estimated: z.boolean().optional(),
        display: z.string().max(300).optional()
    }).strict().optional()
}).strict();
const tradeObservationSchema = z.object({
    reporterCountry: z.string().min(1).max(100),
    partnerCountry: z.string().min(1).max(100),
    reporterCode: z.string().max(16),
    partnerCode: z.string().max(16),
    tradeFlow: z.enum(["IMPORT", "EXPORT"]),
    classification: z.string().min(1).max(40),
    requestedClassification: z.enum(["HS", "HS2017", "HS2022"]),
    commodityCode: z.string().regex(/^\d{2,6}$/),
    commodityDescription: z.string().max(500),
    period: z.string().regex(/^\d{4}(?:\d{2})?$/),
    tradeValueUsd: z.number().finite().nullable(),
    netWeightKg: z.number().finite().nullable(),
    quantity: z.number().finite().nullable(),
    quantityUnit: z.string().max(40).nullable(),
    isAggregate: z.boolean(),
    suppressed: z.boolean(),
    statusFlags: z.array(z.string().min(1).max(80)).max(30),
    sourceRevision: z.string().max(120).nullable(),
    providerRecordId: z.string().min(1).max(255)
}).strict();
const tradeAdapterPageSchema = z.object({
    observations: z.array(tradeObservationSchema).max(500),
    nextCursor: z.string().max(2000).nullable().optional(),
    exhausted: z.boolean().optional(),
    rawCount: z.number().int().min(0).max(1000000).optional(),
    invalidCount: z.number().int().min(0).max(1000000).optional(),
    warnings: z.array(z.string().max(300)).max(50).optional(),
    usage: z.object({
        requestCount: z.number().int().min(0).nullable().optional(),
        quotaUsed: z.number().min(0).nullable().optional(),
        quotaRemaining: z.number().min(0).nullable().optional(),
        costAmount: z.number().min(0).nullable().optional(),
        currency: z.string().max(12).nullable().optional(),
        estimated: z.boolean().optional(),
        display: z.string().max(300).optional()
    }).strict().optional()
}).strict();
const healthResultSchema = z.object({
    ok: z.boolean(),
    message: z.string().min(1).max(500),
    usage: z.object({
        requestCount: z.number().int().min(0).nullable().optional(),
        quotaUsed: z.number().min(0).nullable().optional(),
        quotaRemaining: z.number().min(0).nullable().optional(),
        costAmount: z.number().min(0).nullable().optional(),
        currency: z.string().max(12).nullable().optional(),
        estimated: z.boolean().optional(),
        display: z.string().max(300).optional()
    }).strict().optional()
}).strict();
const enrichmentResultSchema = z.object({
    contact: z.string().max(160).optional(),
    contactInfo: z.string().max(255).optional(),
    officialWebsite: z.string().max(500).optional(),
    sourceUrl: z.string().max(1000).optional(),
    providerRecordId: z.string().max(255).optional(),
    evidenceSummary: z.string().max(1000).optional(),
    matchedFields: z.array(z.string().max(80)).max(30).optional(),
    confidence: z.number().min(0).max(100).optional()
}).strict().refine((value) => Boolean(value.contact?.trim() || value.contactInfo?.trim()), "Provider enrichment must contain contact or contactInfo");
function normalizeList(value) {
    return [...new Set(value
            .split(/,|，|\/|、|\n/)
            .map((item) => item.trim().replace(/\s+/g, " "))
            .filter(Boolean)
            .map((item) => item.toLocaleLowerCase()))]
        .sort((left, right) => left.localeCompare(right));
}
export function normalizeProviderQuery(query) {
    return normalizedQuerySchema.parse({
        goal: query.goal.trim().replace(/\s+/g, " ").slice(0, 500),
        productKeywords: normalizeList(query.productKeywords),
        countries: normalizeList(query.countries),
        industries: normalizeList(query.industry),
        customerTypes: normalizeList(query.customerType),
        excludeKeywords: normalizeList(query.excludeKeywords),
        limit: Math.min(30, Math.max(1, Math.trunc(query.limit)))
    });
}
function normalizeCodeList(values) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
}
export function normalizeTradeQuery(query) {
    return normalizedTradeQuerySchema.parse({
        reporterCodes: normalizeCodeList(query.reporterCodes),
        partnerCodes: normalizeCodeList(query.partnerCodes),
        flow: query.flow,
        hsVersion: query.hsVersion,
        commodityCodes: normalizeCodeList(query.commodityCodes),
        periods: normalizeCodeList(query.periods),
        frequency: query.frequency,
        limit: Math.min(500, Math.max(1, Math.trunc(query.limit ?? 500)))
    });
}
export function defineProvider(provider) {
    return {
        ...provider,
        adapterVersion: provider.adapterVersion || "1.0.0",
        contractVersion: PROVIDER_CONTRACT_VERSION,
        accessMode: provider.accessMode || "api"
    };
}
export function defineTradeProvider(provider) {
    return {
        ...provider,
        adapterVersion: provider.adapterVersion || "1.0.0",
        contractVersion: PROVIDER_CONTRACT_VERSION,
        accessMode: provider.accessMode || "api"
    };
}
function cleanUrl(value) {
    if (!value)
        return "";
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:"
            || parsed.username
            || parsed.password
            || isForbiddenNetworkHostname(parsed.hostname))
            return "";
        parsed.hash = "";
        return parsed.toString();
    }
    catch {
        return "";
    }
}
function stableRecordHash(providerId, record) {
    const stable = JSON.stringify({
        providerId,
        providerRecordId: record.providerRecordId || "",
        company: record.company.trim().toLocaleLowerCase(),
        officialWebsite: cleanUrl(record.officialWebsite || record.website || ""),
        country: (record.country || "").trim().toLocaleLowerCase(),
        sourceUrl: cleanUrl(record.sourceUrl || "")
    });
    return createHash("sha256").update(stable).digest("hex");
}
function defaultUsage(value) {
    return {
        requestCount: value?.requestCount ?? null,
        quotaUsed: value?.quotaUsed ?? null,
        quotaRemaining: value?.quotaRemaining ?? null,
        costAmount: value?.costAmount ?? null,
        currency: value?.currency ?? null,
        estimated: value?.estimated ?? false,
        display: value?.display || ""
    };
}
function retentionPolicyRef(policy) {
    return createHash("sha256").update(JSON.stringify(policy)).digest("hex").slice(0, 24);
}
export function normalizeProviderPage(input) {
    let parsed;
    try {
        parsed = adapterPageSchema.parse(input.page);
    }
    catch (error) {
        throw new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源返回结构发生变化，已暂停本次来源",
            httpStatus: null,
            phase: "search"
        }, { cause: error });
    }
    const allowed = new Set(input.allowedFields);
    const records = [];
    const seen = new Set();
    let duplicateCount = 0;
    let invalidCount = parsed.invalidCount || 0;
    const warnings = [...(parsed.warnings || [])];
    const fetchedAt = new Date().toISOString();
    for (const raw of parsed.records) {
        const company = raw.company.trim();
        if (!company) {
            invalidCount += 1;
            continue;
        }
        const officialWebsite = allowed.has("officialWebsite") || allowed.has("website")
            ? cleanUrl(raw.officialWebsite || raw.website || "")
            : "";
        const sourceUrl = allowed.has("sourceUrl") ? cleanUrl(raw.sourceUrl || "") : "";
        const payloadHash = stableRecordHash(input.provider.id, raw);
        const providerRecordId = (raw.providerRecordId || `hash:${payloadHash}`).trim().slice(0, 255);
        const dedupeKey = `${input.provider.id}:${providerRecordId || payloadHash}`;
        if (seen.has(dedupeKey)) {
            duplicateCount += 1;
            continue;
        }
        seen.add(dedupeKey);
        records.push({
            company,
            officialWebsite,
            website: officialWebsite,
            country: allowed.has("country") ? (raw.country || "").trim() : "",
            business: allowed.has("business") ? (raw.business || "").trim() : "",
            contact: allowed.has("contact") ? (raw.contact || "").trim() : "",
            contactInfo: allowed.has("contactInfo") ? (raw.contactInfo || "").trim() : "",
            description: allowed.has("description") ? (raw.description || "").trim() : "",
            confidence: allowed.has("confidence") ? raw.confidence : undefined,
            providerRecordId,
            sourceUrl,
            recordType: raw.recordType || (input.provider.category === "web" ? "discovery_page" : "company_candidate"),
            fetchedAt,
            payloadHash,
            evidenceSummary: allowed.has("evidenceSummary")
                ? (raw.evidenceSummary || (allowed.has("description") ? raw.description : "") || "").trim().slice(0, 1000)
                : "",
            matchedFields: allowed.has("matchedFields")
                ? [...new Set((raw.matchedFields || []).filter((field) => allowed.has(field)))]
                : [],
            adapterVersion: input.provider.adapterVersion,
            catalogPolicyVersion: input.catalogPolicyVersion,
            sourceLevel: input.sourceLevel,
            retentionPolicyRef: retentionPolicyRef(input.retentionPolicy)
        });
    }
    const rawCount = parsed.rawCount ?? parsed.records.length + invalidCount;
    const exhausted = parsed.exhausted ?? !parsed.nextCursor;
    const status = records.length
        ? (invalidCount || duplicateCount || warnings.length ? "partial_success" : "success")
        : "success_empty";
    return {
        status,
        records,
        nextCursor: parsed.nextCursor || null,
        exhausted,
        rawCount,
        validCount: records.length,
        invalidCount,
        duplicateCount,
        warnings,
        usage: defaultUsage(parsed.usage)
    };
}
function stableTradeObservationHash(providerId, observation) {
    return createHash("sha256").update(JSON.stringify({
        providerId,
        reporterCountry: observation.reporterCountry,
        partnerCountry: observation.partnerCountry,
        reporterCode: observation.reporterCode,
        partnerCode: observation.partnerCode,
        tradeFlow: observation.tradeFlow,
        classification: observation.classification,
        commodityCode: observation.commodityCode,
        commodityDescription: observation.commodityDescription,
        period: observation.period,
        providerRecordId: observation.providerRecordId
    })).digest("hex");
}
export function normalizeProviderTradePage(input) {
    let parsed;
    try {
        parsed = tradeAdapterPageSchema.parse(input.page);
    }
    catch (error) {
        throw new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "贸易数据源返回结构发生变化，已暂停本次来源",
            httpStatus: null,
            phase: "trade"
        }, { cause: error });
    }
    const observations = [];
    const seen = new Set();
    let duplicateCount = 0;
    const fetchedAt = input.fetchedAt || new Date().toISOString();
    for (const observation of parsed.observations) {
        const payloadHash = stableTradeObservationHash(input.provider.id, observation);
        const dedupeKey = `${input.provider.id}:${observation.providerRecordId}:${payloadHash}`;
        if (seen.has(dedupeKey)) {
            duplicateCount += 1;
            continue;
        }
        seen.add(dedupeKey);
        observations.push({
            ...observation,
            reporterCountry: observation.reporterCountry.trim(),
            partnerCountry: observation.partnerCountry.trim(),
            reporterCode: observation.reporterCode.trim(),
            partnerCode: observation.partnerCode.trim(),
            classification: observation.classification.trim(),
            commodityDescription: observation.commodityDescription.trim(),
            quantityUnit: observation.quantityUnit?.trim() || null,
            sourceRevision: observation.sourceRevision?.trim() || null,
            statusFlags: [...new Set(observation.statusFlags.map((flag) => flag.trim()).filter(Boolean))],
            providerRecordId: observation.providerRecordId.trim(),
            fetchedAt,
            payloadHash,
            adapterVersion: input.provider.adapterVersion
        });
    }
    const invalidCount = parsed.invalidCount || 0;
    const warnings = [...(parsed.warnings || [])];
    const rawCount = parsed.rawCount ?? parsed.observations.length + invalidCount;
    const status = observations.length
        ? (invalidCount || duplicateCount || warnings.length ? "partial_success" : "success")
        : "success_empty";
    return {
        status,
        cacheStatus: input.cacheStatus || "live",
        observations,
        nextCursor: parsed.nextCursor || null,
        exhausted: parsed.exhausted ?? !parsed.nextCursor,
        rawCount,
        validCount: observations.length,
        invalidCount,
        duplicateCount,
        warnings,
        usage: defaultUsage(parsed.usage)
    };
}
export function normalizeProviderHealthResult(value) {
    try {
        const parsed = healthResultSchema.parse(value);
        return {
            ok: parsed.ok,
            message: parsed.message.trim(),
            usage: parsed.usage ? defaultUsage(parsed.usage) : undefined
        };
    }
    catch (error) {
        throw new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源健康检查返回结构发生变化",
            httpStatus: null,
            phase: "health"
        }, { cause: error });
    }
}
export function normalizeProviderEnrichment(input) {
    if (input.result === null || input.result === undefined)
        return null;
    let parsed;
    try {
        parsed = enrichmentResultSchema.parse(input.result);
    }
    catch (error) {
        throw new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "联系人补全返回结构发生变化",
            httpStatus: null,
            phase: "enrich"
        }, { cause: error });
    }
    const page = normalizeProviderPage({
        provider: input.provider,
        catalogPolicyVersion: input.catalogPolicyVersion,
        sourceLevel: input.sourceLevel,
        allowedFields: input.allowedFields,
        retentionPolicy: input.retentionPolicy,
        page: {
            records: [{
                    company: input.domain,
                    officialWebsite: parsed.officialWebsite || `https://${input.domain}`,
                    contact: parsed.contact,
                    contactInfo: parsed.contactInfo,
                    confidence: parsed.confidence,
                    providerRecordId: parsed.providerRecordId,
                    sourceUrl: parsed.sourceUrl,
                    recordType: "contact_evidence",
                    evidenceSummary: parsed.evidenceSummary,
                    matchedFields: parsed.matchedFields,
                    description: parsed.evidenceSummary
                }],
            exhausted: true
        }
    });
    const evidence = page.records[0];
    if (!evidence?.contact && !evidence?.contactInfo) {
        throw new ProviderContractError({
            code: "PROVIDER_POLICY_BLOCKED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源目录未允许联系人补全字段",
            httpStatus: null,
            phase: "enrich"
        });
    }
    return {
        contact: evidence.contact || "",
        contactInfo: evidence.contactInfo || "",
        confidence: evidence.confidence,
        evidence
    };
}
export function providerErrorFromUnknown(error, phase) {
    if (error instanceof ProviderContractError)
        return error;
    const message = error instanceof Error ? error.message : "";
    const httpStatus = error instanceof ProviderHttpStatusError
        ? error.httpStatus
        : null;
    const retryAt = error instanceof ProviderHttpStatusError ? error.retryAfterAt : null;
    const lower = message.toLocaleLowerCase();
    if (httpStatus === 401 || httpStatus === 403) {
        return new ProviderContractError({
            code: "PROVIDER_AUTH_FAILED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源授权已失效，请检查连接配置",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (httpStatus === 429) {
        return new ProviderContractError({
            code: "PROVIDER_RATE_LIMITED",
            retryable: true,
            retryAfterAt: retryAt,
            publicMessage: "数据源当前限流，可稍后重试",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (httpStatus === 402) {
        return new ProviderContractError({
            code: "PROVIDER_QUOTA_EXHAUSTED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源额度已用尽，请检查套餐或预算",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (lower.includes("abort") || lower.includes("timeout") || lower.includes("超时")) {
        return new ProviderContractError({
            code: "PROVIDER_TIMEOUT",
            retryable: true,
            retryAfterAt: null,
            publicMessage: "数据源响应超时，可稍后重试",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (lower.includes("policy") || lower.includes("白名单") || lower.includes("内网") || lower.includes("不允许")) {
        return new ProviderContractError({
            code: "PROVIDER_POLICY_BLOCKED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源请求被安全策略阻止",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (httpStatus && httpStatus >= 500) {
        return new ProviderContractError({
            code: "PROVIDER_UNAVAILABLE",
            retryable: true,
            retryAfterAt: null,
            publicMessage: "数据源暂时不可用，可稍后重试",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (httpStatus === 400 || httpStatus === 404 || httpStatus === 422) {
        return new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源请求或返回结构不兼容，请检查适配器",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (error instanceof SyntaxError) {
        return new ProviderContractError({
            code: "PROVIDER_SCHEMA_CHANGED",
            retryable: false,
            retryAfterAt: null,
            publicMessage: "数据源返回结构无法解析，请检查适配器",
            httpStatus,
            phase
        }, { cause: error });
    }
    if (lower.includes("econn")
        || lower.includes("enotfound")
        || lower.includes("socket")
        || lower.includes("network")
        || lower.includes("tls")) {
        return new ProviderContractError({
            code: "PROVIDER_NETWORK_ERROR",
            retryable: true,
            retryAfterAt: null,
            publicMessage: "数据源连接异常，可稍后重试",
            httpStatus,
            phase
        }, { cause: error });
    }
    return new ProviderContractError({
        code: "PROVIDER_INTERNAL_ERROR",
        retryable: false,
        retryAfterAt: null,
        publicMessage: "数据源适配器执行异常，请检查配置或适配器",
        httpStatus,
        phase
    }, { cause: error });
}
