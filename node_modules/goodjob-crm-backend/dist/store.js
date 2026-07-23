import { acquisitionOutcomeFeedback, agentJobIdempotencyAliases, agentJobs, aiModelConfigs, aiSiteBuilderProjects, aiSiteBuilderSettings, caseStudies, commissionCalculations, commissionExports, commissionItems, commissionProducts, commissionRules, companyProfiles, competitors, customerActivities, customers, dailyReportComments, dailyReports, dealEvents, deals, examAttempts, examQuestionLinks, examQuestions, exams, importExportJobs, internalMessages, knowledgeAssets, leadActivities, leadSourceConfigs, leadSourceEvents, leads, memos, monthlySalesRecords, ocrJobs, planTemplates, planTasks, problems, providerCatalog, providerConnections, providerRequestLogs, providerResponseCache, prospectCampaignEvents, prospectCampaigns, prospectCampaignVersions, prospectExecutionAttempts, prospectExecutionCheckpoints, prospectExecutionEvents, prospectExecutionKernelStates, prospectExecutionLeases, prospectExecutionPages, prospectExecutionThrottleBuckets, prospectStrategySourcePositions, prospectProviderRequestAccountingEvidence, prospectProviderRequestAttemptBindings, prospectProviderRequestDispatches, prospectProviderRequestEvents, prospectProviderRequestLedgers, prospectSourceRawBatches, prospectSourceRawHits, prospectSourceRawRecords, organizations, organizationAcceptedIdentifiers, organizationIdentityClaims, organizationIdentityConflicts, organizationIdentityConflictReviews, organizationIdentityEvents, organizationIdentityResolutions, organizationAliasFacts, organizationCanonicalMappings, organizationRelationFacts, organizationSourceBindings, companyVerificationSnapshots, prospectContactChannels, prospectContactVerificationSnapshots, prospectContactabilityDecisions, prospectContacts, prospectCoverageEvents, prospectEvidence, prospectIcpAssessmentSnapshots, prospectIcpPolicySnapshots, prospectSuppressionEvents, prospectTouchpoints, procurementSignals, dealRecommendations, customerIntelligenceSuggestions, tenantProspects, prospectRunEvents, prospectRunQueueChildBindings, prospectRunQueueParentBindings, prospectRunShards, prospectSearchRuns, prospectSchedules, prospectStrategies, prospectStrategyEvents, prospectStrategySuggestions, marketTradeObservations, marketOpportunityBatches, marketOpportunitySnapshots, marketOpportunityCalculationEvents, reminders, salesRecordAudits, todos, tradeDocuments, users, wecomMessages, websiteOpportunities, whatsappBindings, whatsappMessages } from "./data.js";
import { convertProspectToCustomer } from "./prospect-customer-conversion.js";
import { convertProspectToLead } from "./prospect-lead-conversion.js";
import { applyProspectQualificationCommand } from "./prospect-qualification.js";
import { ensureProspectVerificationReport } from "./prospect-verification.js";
import { mutateCustomerOwnershipMemory } from "./customer-public-pool.js";
export const memoryStore = {
    mode: "memory",
    users,
    companyProfiles,
    dailyReports,
    dailyReportComments,
    internalMessages,
    customers,
    customerOwnershipEvents: [],
    customerActivities,
    customerAcquisitionSourceEvents: [],
    customerIntelligenceSuggestions,
    leads,
    leadActivities,
    leadSourceEvents,
    todos,
    deals,
    dealEvents,
    reminders,
    knowledgeAssets,
    exams,
    examQuestions,
    examQuestionLinks,
    examAttempts,
    importExportJobs,
    tradeDocuments,
    wecomMessages,
    ocrJobs,
    websiteOpportunities: websiteOpportunities.map((item) => ensureProspectVerificationReport(item)),
    aiModelConfigs,
    aiSiteBuilderProjects,
    aiSiteBuilderSettings,
    providerCatalog,
    providerConnections,
    providerRequestLogs,
    providerResponseCache,
    marketTradeObservations,
    marketOpportunityBatches,
    marketOpportunitySnapshots,
    marketOpportunityCalculationEvents,
    agentJobs,
    agentJobIdempotencyAliases,
    prospectCampaigns,
    prospectCampaignVersions,
    prospectCampaignEvents,
    prospectStrategies,
    prospectStrategyEvents,
    prospectSchedules,
    prospectSearchRuns,
    prospectRunShards,
    prospectRunEvents,
    prospectRunQueueParentBindings,
    prospectRunQueueChildBindings,
    prospectExecutionKernelStates,
    prospectExecutionCheckpoints,
    prospectStrategySourcePositions,
    prospectExecutionLeases,
    prospectExecutionAttempts,
    prospectProviderRequestLedgers,
    prospectProviderRequestDispatches,
    prospectProviderRequestEvents,
    prospectProviderRequestAttemptBindings,
    prospectProviderRequestAccountingEvidence,
    prospectSourceRawBatches,
    prospectSourceRawRecords,
    prospectSourceRawHits,
    prospectCandidateProcessingStates: [],
    organizations,
    organizationIdentityClaims,
    organizationAcceptedIdentifiers,
    organizationIdentityResolutions,
    organizationSourceBindings,
    organizationIdentityConflicts,
    organizationIdentityConflictReviews,
    organizationCanonicalMappings,
    organizationAliasFacts,
    organizationRelationFacts,
    organizationIdentityEvents,
    tenantProspects,
    prospectCoverageEvents,
    prospectEvidence,
    companyVerificationSnapshots,
    prospectIcpPolicySnapshots,
    prospectIcpAssessmentSnapshots,
    prospectContacts,
    prospectContactChannels,
    prospectContactVerificationSnapshots,
    prospectSuppressionEvents,
    prospectContactabilityDecisions,
    prospectTouchpoints,
    procurementSignals,
    dealRecommendations,
    acquisitionOutcomeFeedback,
    prospectStrategySuggestions,
    prospectExecutionPages,
    prospectExecutionEvents,
    prospectExecutionThrottleBuckets,
    leadSourceConfigs,
    planTasks,
    planTemplates,
    problems,
    memos,
    competitors,
    caseStudies,
    whatsappMessages,
    whatsappBindings,
    commissionProducts,
    commissionRules,
    monthlySalesRecords,
    salesRecordAudits,
    commissionCalculations,
    commissionItems,
    commissionExports,
    async persist() {
        // Memory mode intentionally keeps current in-process state only.
    },
    async mutateCustomerOwnership(input) {
        return mutateCustomerOwnershipMemory(memoryStore, input);
    },
    async reloadOrganizationIdentityTeam() {
        // Memory mode already reads the current in-process identity state.
    },
    async reloadOrganizationIdentityConflictReviewTeam() {
        // Memory mode already reads the current in-process review state.
    },
    async reloadOrganizationRelationsTeam() {
        // Memory mode already reads the current in-process organization facts.
    },
    async reloadProspectCoverageTeam() {
        // Memory mode already reads the current in-process coverage state.
    },
    async convertProspectToLead(input) {
        const coverageSecret = process.env.PROSPECT_COVERAGE_MASTER_SECRET
            || process.env.ORGANIZATION_IDENTITY_MASTER_SECRET
            || "";
        return convertProspectToLead(memoryStore, {
            ...input,
            coverageSecret
        });
    },
    async convertProspectToCustomer(input) {
        const coverageSecret = process.env.PROSPECT_COVERAGE_MASTER_SECRET
            || process.env.ORGANIZATION_IDENTITY_MASTER_SECRET
            || "";
        return convertProspectToCustomer(memoryStore, {
            ...input,
            coverageSecret
        });
    },
    async applyProspectQualification(input) {
        return applyProspectQualificationCommand(memoryStore, input);
    },
    async reloadProspectQualificationTeam() {
        // Memory mode already reads the current in-process qualification state.
    },
    async readBarrier() {
        // Memory mode has no asynchronous persistence queue.
    },
    async close() {
        // Memory mode has no external resources.
    }
};
let activeStore = memoryStore;
export function getStore() {
    return activeStore;
}
export function setStore(store) {
    activeStore = store;
}
