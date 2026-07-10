import { aiModelConfigs, aiSiteBuilderProjects, aiSiteBuilderSettings, caseStudies, competitors, customers, deals, examAttempts, examQuestionLinks, examQuestions, exams, importExportJobs, knowledgeAssets, leadSourceConfigs, memos, ocrJobs, planTemplates, planTasks, problems, reminders, todos, tradeDocuments, users, wecomMessages, websiteOpportunities } from "./data.js";
export const memoryStore = {
    mode: "memory",
    users,
    customers,
    todos,
    deals,
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
    websiteOpportunities,
    aiModelConfigs,
    aiSiteBuilderProjects,
    aiSiteBuilderSettings,
    leadSourceConfigs,
    planTasks,
    planTemplates,
    problems,
    memos,
    competitors,
    caseStudies,
    async persist() {
        // Memory mode intentionally keeps current in-process state only.
    }
};
let activeStore = memoryStore;
export function getStore() {
    return activeStore;
}
export function setStore(store) {
    activeStore = store;
}
