import { ProspectCoverageMemoryError, setTenantProspectDisposition } from "./prospect-coverage-memory.js";
function invalid(message) {
    throw new ProspectCoverageMemoryError("PROSPECT_COVERAGE_INVALID", message);
}
function dispositionFor(action) {
    switch (action) {
        case "mark-contactable":
            return {
                action: "mark_reviewed",
                reasonCode: "MANUAL_CONTACTABLE_REVIEW"
            };
        case "exclude":
            return {
                action: "exclude_permanent",
                reasonCode: "MANUAL_CANDIDATE_EXCLUDE"
            };
        case "restore":
            return {
                action: "resume",
                reasonCode: "MANUAL_CANDIDATE_RESUME"
            };
        case "link-lead":
            return {
                action: "link_crm",
                reasonCode: "CRM_LEAD_LINKED"
            };
    }
}
function applyCoverageResult(candidate, result) {
    candidate.tenantProspectId = result.prospect.id;
    candidate.organizationId =
        result.prospect.organizationId || candidate.organizationId;
    candidate.coverageQueueState = result.prospect.queueState;
    candidate.coverageReasonCode = result.event.reasonCode;
}
function applyCandidateAction(input, result) {
    if (result.prospect.status === "converted") {
        input.candidate.status = "synced";
        input.candidate.leadId =
            result.prospect.leadId || input.candidate.leadId;
        input.candidate.customerId =
            result.prospect.customerId || input.candidate.customerId;
        input.candidate.dealId =
            result.prospect.dealId || input.candidate.dealId;
        input.candidate.excludedReason = "";
        input.candidate.statusChangedAt = input.effectiveAt;
        return;
    }
    switch (input.action) {
        case "mark-contactable":
            if (input.candidate.status !== "contacted") {
                input.candidate.status = "contactable";
            }
            input.candidate.verifiedAt =
                input.candidate.verifiedAt || input.effectiveAt;
            input.candidate.excludedReason = "";
            break;
        case "exclude":
            input.candidate.status = "excluded";
            input.candidate.excludedReason =
                input.candidate.excludedReason || "人工核验后排除";
            break;
        case "restore":
            input.candidate.status = "preview";
            input.candidate.excludedReason = "";
            break;
        case "link-lead":
            input.candidate.status = "synced";
            input.candidate.leadId = input.leadId;
            input.candidate.excludedReason = "";
            break;
    }
    input.candidate.statusChangedAt = input.effectiveAt;
}
export async function syncProspectCandidateCoverage(input) {
    const prospectId = input.candidate.tenantProspectId?.trim();
    if (!prospectId)
        return null;
    const prospect = input.store.tenantProspects.find((item) => item.id === prospectId
        && item.teamId === input.candidate.teamId);
    if (!prospect) {
        invalid("候选覆盖记录不存在或不属于当前团队");
    }
    if (input.candidate.organizationId
        && prospect.organizationId !== input.candidate.organizationId) {
        invalid("候选与覆盖记录的企业身份不一致");
    }
    if (input.action === "link-lead" && !input.leadId) {
        invalid("加入线索后必须提供线索标识");
    }
    const disposition = dispositionFor(input.action);
    const persistedInput = {
        teamId: input.candidate.teamId,
        ownerId: input.actorId,
        prospectId,
        requestId: input.requestId.slice(0, 500),
        operationCode: "set_tenant_prospect_disposition_v1",
        action: disposition.action,
        reasonCode: disposition.reasonCode,
        effectiveAt: input.effectiveAt,
        ...(input.action === "link-lead"
            ? { leadId: input.leadId }
            : {})
    };
    const result = input.store.setTenantProspectDisposition
        ? await input.store.setTenantProspectDisposition(persistedInput)
        : setTenantProspectDisposition(input.store, {
            ...persistedInput,
            coverageSecret: input.coverageSecret
                || process.env.PROSPECT_COVERAGE_MASTER_SECRET
                || process.env.ORGANIZATION_IDENTITY_MASTER_SECRET
                || ""
        });
    applyCoverageResult(input.candidate, result);
    applyCandidateAction(input, result);
    return result;
}
