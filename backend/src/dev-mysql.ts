process.env.CRM_STORE = "mysql";
process.env.CRM_SEED_DEVELOPMENT_DATA = process.env.CRM_SEED_DEVELOPMENT_DATA || "true";

await import("./server.js");
