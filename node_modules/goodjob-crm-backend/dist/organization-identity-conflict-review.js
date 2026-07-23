import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { canonicalJsonStringify } from "./canonical-json.js";
export const organizationIdentityConflictListQuerySchema = z.object({
    status: z.enum(["open", "resolved", "all"]).default("open")
});
export const organizationIdentityConflictReviewBodySchema = z.object({
    action: z.enum(["keep_separate", "merge"]),
    canonicalOrganizationId: z.string().trim().max(90).optional().default(""),
    note: z.string().trim().min(2).max(1000)
}).superRefine((value, context) => {
    if (value.action === "merge" && !value.canonicalOrganizationId) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canonicalOrganizationId"],
            message: "合并企业时必须选择规范企业"
        });
    }
    if (value.action === "keep_separate" && value.canonicalOrganizationId) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canonicalOrganizationId"],
            message: "保持独立时不能指定规范企业"
        });
    }
});
export class OrganizationIdentityConflictReviewError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = "OrganizationIdentityConflictReviewError";
    }
}
function sha256(value) {
    return createHash("sha256")
        .update(canonicalJsonStringify(value))
        .digest("hex");
}
export function organizationIdentityConflictReviewHash(review) {
    return sha256({
        contract: "organization-identity-conflict-review-v1",
        ...review
    });
}
export function organizationCanonicalMappingHash(mapping) {
    return sha256({
        contract: "organization-canonical-mapping-v1",
        ...mapping
    });
}
export function organizationIdentityConflictEtag(conflictId, revision) {
    return `"organization-identity-conflict:${conflictId}:${revision}"`;
}
export function requireOrganizationIdentityReviewer(user) {
    if (user.role !== "manager" && user.role !== "admin") {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_REVIEW_FORBIDDEN", "只有本团队主管或管理员可以复核企业身份冲突", 403);
    }
}
function teamMappings(store, teamId) {
    return store.organizationCanonicalMappings.filter((item) => item.teamId === teamId);
}
function resolveCanonicalFromMappings(mappings, organizationId) {
    const bySource = new Map(mappings.map((item) => [item.sourceOrganizationId, item]));
    const visited = new Set();
    let current = organizationId;
    for (let depth = 0; depth < 32; depth += 1) {
        if (visited.has(current)) {
            throw new OrganizationIdentityConflictReviewError("IDENTITY_MAPPING_CYCLE", "规范企业映射存在循环，已拒绝继续解析", 409);
        }
        visited.add(current);
        const mapping = bySource.get(current);
        if (!mapping)
            return current;
        current = mapping.canonicalOrganizationId;
    }
    throw new OrganizationIdentityConflictReviewError("IDENTITY_MAPPING_CYCLE", "规范企业映射层级超过安全上限", 409);
}
export function canonicalOrganizationId(store, teamId, organizationId) {
    if (!organizationId)
        return "";
    return resolveCanonicalFromMappings(teamMappings(store, teamId), organizationId);
}
function currentReview(store, conflict) {
    return store.organizationIdentityConflictReviews.find((item) => item.teamId === conflict.teamId
        && item.conflictId === conflict.id);
}
function assertIfMatch(conflict, review, ifMatch) {
    if (!ifMatch) {
        throw new OrganizationIdentityConflictReviewError("PRECONDITION_REQUIRED", "缺少 If-Match，请刷新冲突列表后重试", 428);
    }
    const revision = review ? 2 : 1;
    if (ifMatch !== organizationIdentityConflictEtag(conflict.id, revision)) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_CONFLICT_REVISION_CONFLICT", "企业身份冲突已发生变化，请刷新后重试", 412);
    }
}
function conflictForReview(store, user, conflictId) {
    const conflict = store.organizationIdentityConflicts.find((item) => item.id === conflictId && item.teamId === user.teamId);
    if (!conflict) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_CONFLICT_NOT_FOUND", "企业身份冲突不存在或无权访问", 404);
    }
    return conflict;
}
function plannedMappings(store, user, conflict, canonicalId, createdAt) {
    if (!conflict.organizationIds.includes(canonicalId)) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_REVIEW_INVALID", "规范企业必须是当前冲突中的候选企业", 400);
    }
    const organizationIds = new Set(store.organizations
        .filter((item) => item.teamId === user.teamId)
        .map((item) => item.id));
    if (!conflict.organizationIds.every((id) => organizationIds.has(id))) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_REVIEW_INVALID", "冲突中的企业主体不完整，无法执行合并", 409);
    }
    const existing = teamMappings(store, user.teamId);
    if (resolveCanonicalFromMappings(existing, canonicalId) !== canonicalId) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_MAPPING_CONFLICT", "所选规范企业已映射到其他企业，请先刷新冲突状态", 409);
    }
    const additions = [];
    for (const sourceOrganizationId of conflict.organizationIds) {
        if (sourceOrganizationId === canonicalId)
            continue;
        const resolved = resolveCanonicalFromMappings(existing, sourceOrganizationId);
        if (resolved === canonicalId)
            continue;
        if (resolved !== sourceOrganizationId) {
            throw new OrganizationIdentityConflictReviewError("IDENTITY_MAPPING_CONFLICT", "候选企业已经指向其他规范企业，不能重复合并", 409);
        }
        const base = {
            id: `ocm_${randomUUID()}`,
            conflictId: conflict.id,
            teamId: user.teamId,
            sourceOrganizationId,
            canonicalOrganizationId: canonicalId,
            createdBy: user.id,
            createdAt
        };
        const mapping = {
            ...base,
            mappingHash: organizationCanonicalMappingHash(base)
        };
        const proposed = [...existing, ...additions, mapping];
        if (resolveCanonicalFromMappings(proposed, sourceOrganizationId) !== canonicalId) {
            throw new OrganizationIdentityConflictReviewError("IDENTITY_MAPPING_CYCLE", "本次合并会形成规范企业映射循环", 409);
        }
        additions.push(mapping);
    }
    return additions;
}
export function buildOrganizationIdentityConflictReview(store, input) {
    requireOrganizationIdentityReviewer(input.user);
    const conflict = conflictForReview(store, input.user, input.conflictId);
    const existingReview = currentReview(store, conflict);
    assertIfMatch(conflict, existingReview, input.ifMatch);
    if (existingReview) {
        throw new OrganizationIdentityConflictReviewError("IDENTITY_CONFLICT_ALREADY_REVIEWED", "该企业身份冲突已经完成复核，历史结论不可覆盖", 409);
    }
    const createdAt = new Date().toISOString();
    const mappings = input.body.action === "merge"
        ? plannedMappings(store, input.user, conflict, input.body.canonicalOrganizationId, createdAt)
        : [];
    const base = {
        id: `oicr_${randomUUID()}`,
        conflictId: conflict.id,
        teamId: input.user.teamId,
        action: input.body.action,
        canonicalOrganizationId: input.body.action === "merge"
            ? input.body.canonicalOrganizationId
            : "",
        note: input.body.note,
        reviewedBy: input.user.id,
        createdAt
    };
    const review = {
        ...base,
        reviewHash: organizationIdentityConflictReviewHash(base)
    };
    return { review, mappings };
}
export async function reviewOrganizationIdentityConflict(store, input) {
    if (store.reviewOrganizationIdentityConflict) {
        return store.reviewOrganizationIdentityConflict(input);
    }
    const built = buildOrganizationIdentityConflictReview(store, input);
    store.organizationIdentityConflictReviews.push(built.review);
    store.organizationCanonicalMappings.push(...built.mappings);
    try {
        await store.persist();
    }
    catch (error) {
        store.organizationIdentityConflictReviews.splice(store.organizationIdentityConflictReviews.indexOf(built.review), 1);
        for (const mapping of built.mappings) {
            const index = store.organizationCanonicalMappings.indexOf(mapping);
            if (index >= 0)
                store.organizationCanonicalMappings.splice(index, 1);
        }
        throw error;
    }
    return {
        ...built,
        revision: 2,
        etag: organizationIdentityConflictEtag(input.conflictId, 2)
    };
}
export function listOrganizationIdentityConflicts(store, user, status) {
    requireOrganizationIdentityReviewer(user);
    const userNames = new Map(store.users.map((item) => [item.id, item.name]));
    return store.organizationIdentityConflicts
        .filter((conflict) => conflict.teamId === user.teamId)
        .map((conflict) => {
        const review = currentReview(store, conflict);
        const effectiveStatus = review ? "resolved" : "open";
        if (status !== "all" && status !== effectiveStatus)
            return null;
        const organizations = conflict.organizationIds.map((id) => {
            const organization = store.organizations.find((item) => item.id === id && item.teamId === user.teamId);
            return {
                id,
                name: organization?.legalName || `企业 ${id.slice(-8)}`,
                canonicalOrganizationId: canonicalOrganizationId(store, user.teamId, id)
            };
        });
        const affectedOrganizationIds = new Set(conflict.organizationIds);
        const candidateCount = store.tenantProspects.filter((item) => item.teamId === user.teamId
            && affectedOrganizationIds.has(item.organizationId)).length;
        const revision = review ? 2 : 1;
        return {
            id: conflict.id,
            conflictType: conflict.conflictType,
            createdAt: conflict.createdAt,
            effectiveStatus,
            revision,
            etag: organizationIdentityConflictEtag(conflict.id, revision),
            identifierCount: conflict.identifierKeys.length,
            candidateCount,
            organizations,
            review: review
                ? {
                    action: review.action,
                    canonicalOrganizationId: review.canonicalOrganizationId,
                    note: review.note,
                    reviewedBy: review.reviewedBy,
                    reviewedByName: userNames.get(review.reviewedBy) || "本团队管理员",
                    createdAt: review.createdAt
                }
                : null
        };
    })
        .filter((item) => Boolean(item))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
