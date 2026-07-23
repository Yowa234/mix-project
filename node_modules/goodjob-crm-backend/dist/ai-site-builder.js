import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { requireAuth } from "./auth.js";
import { createAiHttpClient } from "./ai-http-security.js";
import { getStore } from "./store.js";
const serverModuleDir = path.dirname(fileURLToPath(import.meta.url));
const goodJobProjectRoot = path.resolve(serverModuleDir, "..", "..");
const AI_SITE_MODEL_TIMEOUT_MS = 100000;
function asyncRoute(handler) {
    return (req, res, next) => {
        handler(req, res, next).catch(next);
    };
}
function providerLabel(provider) {
    const labels = {
        openai: "OpenAI",
        anthropic: "Claude",
        claude: "Claude",
        gemini: "Gemini",
        deepseek: "DeepSeek",
        qwen: "Qwen",
        doubao: "Doubao",
        moonshot: "Kimi",
        zhipu: "GLM",
        baidu: "Qianfan",
        volcengine: "Volcengine",
        mistral: "Mistral",
        groq: "Groq",
        openrouter: "OpenRouter",
        ollama: "Ollama",
        custom: "Custom"
    };
    return labels[provider] || provider || "AI model";
}
async function readAiJson(response) {
    const text = await response.text();
    if (!response.ok) {
        throw new Error(text.slice(0, 500) || `AI request failed with ${response.status}`);
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error(`AI response is not valid JSON: ${text.slice(0, 300)}`);
    }
}
async function callAiModel(config, prompt, maxInputChars = 12000) {
    const protocol = config.protocol || "openai-compatible";
    const endpointBase = config.baseUrl.replace(/\/+$/, "");
    const secureClient = createAiHttpClient(endpointBase);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_SITE_MODEL_TIMEOUT_MS);
    try {
        if (protocol === "anthropic") {
            const response = await secureClient.fetch(`${endpointBase}/messages`, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "x-api-key": config.apiKey,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: config.model,
                    max_tokens: 2200,
                    temperature: config.temperature ?? 0.25,
                    system: "Return only valid JSON. Do not add markdown fences.",
                    messages: [{ role: "user", content: prompt.slice(0, maxInputChars) }]
                })
            });
            const data = await readAiJson(response);
            const content = data.content?.map((item) => item.text || "").join("\n").trim() || "";
            if (!content)
                throw new Error("AI model returned empty content");
            return content;
        }
        if (protocol === "gemini") {
            const response = await secureClient.fetch(`${endpointBase}/models/${encodeURIComponent(config.model)}:generateContent`, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": config.apiKey
                },
                body: JSON.stringify({
                    generationConfig: { temperature: config.temperature ?? 0.25 },
                    contents: [{ role: "user", parts: [{ text: `Return only valid JSON. Do not add markdown fences.\n${prompt.slice(0, maxInputChars)}` }] }]
                })
            });
            const data = await readAiJson(response);
            const content = data.candidates?.[0]?.content?.parts?.map((item) => item.text || "").join("\n").trim() || "";
            if (!content)
                throw new Error("AI model returned empty content");
            return content;
        }
        const response = await secureClient.fetch(`${endpointBase}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                authorization: `Bearer ${config.apiKey}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: config.model,
                temperature: config.temperature ?? 0.25,
                messages: [
                    { role: "system", content: "Return only valid JSON. Do not add markdown fences." },
                    { role: "user", content: prompt.slice(0, maxInputChars) }
                ],
                response_format: { type: "json_object" }
            })
        });
        const data = await readAiJson(response);
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        if (!content)
            throw new Error("AI model returned empty content");
        return content;
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError")
            throw new Error("This operation was aborted after 100s timeout");
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
function extractJsonObject(content) {
    const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
        return JSON.parse(trimmed);
    }
    catch {
        // fall through to object slicing
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
        return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("AI output does not contain a valid JSON object");
}
function normalizeString(value) {
    return String(value ?? "").trim();
}
function normalizeStringArray(value) {
    if (Array.isArray(value))
        return value.map(normalizeString).filter(Boolean);
    if (typeof value === "string")
        return value.split(/[,，\n\r]+/).map(normalizeString).filter(Boolean);
    return [];
}
function cleanHtml(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function normalizeAiTestStatus(value) {
    return value === "passed" || value === "failed" || value === "untested" ? value : "untested";
}
function getAiConfigs(user) {
    return getStore().aiModelConfigs
        .filter((item) => item.ownerId === user.id)
        .sort((left, right) => Number(right.enabled) - Number(left.enabled) || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}
function getAiConfig(user) {
    const configs = getAiConfigs(user);
    return configs.find((item) => item.enabled && item.apiKey) || configs[0] || null;
}
async function testAiConfig(config) {
    try {
        const content = await callAiModel(config, "{\"ok\":true}", 1200);
        const ok = /ok|true/i.test(content);
        return {
            ok,
            message: ok ? `${providerLabel(config.provider)} connection test passed` : "Model responded, but the response did not match the expected test format"
        };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? `AI connection failed: ${error.message}` : "AI connection failed"
        };
    }
}
export function registerAiSiteBuilderRoutes(app) {
    function normalizeAiSiteSchemaData(value) {
        const source = (value && typeof value === "object" ? value : {});
        const company = source.company_profile || {};
        const contact = source.contact_info || {};
        const taxonomy = source.business_taxonomy || {};
        const social = source.social_links || {};
        const style = source.style_requirements || {};
        return {
            company_profile: {
                legal_name: normalizeString(company.legal_name),
                wordmark: normalizeString(company.wordmark),
                tagline: normalizeString(company.tagline),
                description: normalizeString(company.description),
                logo_url: normalizeString(company.logo_url)
            },
            contact_info: {
                phone: normalizeString(contact.phone),
                email: normalizeString(contact.email),
                address: normalizeString(contact.address)
            },
            business_taxonomy: {
                product_categories: normalizeStringArray(taxonomy.product_categories).slice(0, 10),
                solutions: []
            },
            social_links: {
                linkedin: normalizeString(social.linkedin),
                youtube: normalizeString(social.youtube),
                facebook: normalizeString(social.facebook)
            },
            style_requirements: {
                preset: normalizeString(style.preset) || "industrial-professional",
                colors: normalizeStringArray(style.colors),
                keywords: normalizeStringArray(style.keywords),
                reference_sites: normalizeStringArray(style.reference_sites),
                custom_notes: normalizeString(style.custom_notes)
            }
        };
    }
    function normalizeAgentPayload(value, schemaData, pages) {
        if (value && typeof value === "object" && !Array.isArray(value))
            return value;
        return {
            task_type: "ai_website_build",
            schema_version: "data-schema.v1",
            locale: "zh-CN",
            source: "goodjob_ai_site_builder",
            website_data: {
                company_profile: schemaData.company_profile,
                contact_info: schemaData.contact_info,
                business_taxonomy: schemaData.business_taxonomy,
                social_links: schemaData.social_links
            },
            style_requirements: schemaData.style_requirements,
            generation_requirements: {
                target_pages: pages,
                output_mode: "project_task_draft",
                handoff_target: "agent"
            }
        };
    }
    const aiSiteSectionKeys = ["header", "hero", "products", "applications", "about_us", "blog", "contact_us", "footer"];
    const aiSiteLockedSections = new Set(["header", "footer"]);
    const aiSiteCustomSectionKeyPattern = /^custom_[a-z0-9_]{6,48}$/i;
    const aiSiteSectionLabels = {
        header: "Header",
        hero: "Hero",
        products: "Products",
        applications: "Applications",
        about_us: "About Us",
        blog: "Blog",
        contact_us: "Contact Us",
        footer: "Footer"
    };
    function isAiSiteSectionKey(value) {
        return aiSiteSectionKeys.includes(value) || aiSiteCustomSectionKeyPattern.test(value);
    }
    function htmlEscape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
    function aiBuildRoot() {
        const configured = process.env.AI_SITE_BUILD_DIR?.trim();
        if (configured) {
            return path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(goodJobProjectRoot, configured);
        }
        return path.join(goodJobProjectRoot, "projects", "ai_build");
    }
    function aiProjectDir(projectId) {
        return path.join(aiBuildRoot(), projectId);
    }
    function aiSiteSettingsFile() {
        return path.join(aiBuildRoot(), "_settings.json");
    }
    function aiSiteDesignSystemFile(projectId) {
        return path.join(aiProjectDir(projectId), "design-system.json");
    }
    function aiSiteVariantRegistryFile(projectId) {
        return path.join(aiProjectDir(projectId), "variant-registry.json");
    }
    function aiProjectMetaFile(projectId) {
        return path.join(aiProjectDir(projectId), "project.json");
    }
    function aiSiteCustomPagesFile(projectId) {
        return path.join(aiProjectDir(projectId), "custom-pages.json");
    }
    function aiSiteWpMetadataFile(projectId) {
        return path.join(aiProjectDir(projectId), "wp-metadata.json");
    }
    function aiSiteReferenceSitesFile(projectId) {
        return path.join(aiProjectDir(projectId), "reference-sites.json");
    }
    function aiSiteWpRebuildDir(projectId) {
        return path.join(aiProjectDir(projectId), "wp-rebuild");
    }
    function aiSiteWpRebuildExportDir(projectId) {
        return path.join(aiSiteWpRebuildDir(projectId), "export");
    }
    function aiExportDir(projectId) {
        return path.join(aiProjectDir(projectId), "dist");
    }
    function aiSectionFile(projectId, sectionKey) {
        if (!isAiSiteSectionKey(sectionKey))
            throw new Error("Invalid AI site section key");
        return path.join(aiProjectDir(projectId), "sections", `${sectionKey}.html`);
    }
    function aiSectionRevisionDir(projectId, sectionKey) {
        if (!isAiSiteSectionKey(sectionKey))
            throw new Error("Invalid AI site section key");
        return path.join(aiProjectDir(projectId), "revisions", sectionKey);
    }
    function cleanAiSiteRevisionReason(value) {
        return String(value || "edit").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "edit";
    }
    async function snapshotAiSiteSection(project, sectionKey, reason = "edit") {
        const file = aiSectionFile(project.id, sectionKey);
        const exists = await fileExists(file);
        const html = exists
            ? await readFile(file, "utf8").catch(() => "")
            : defaultAiSectionHtml(sectionKey, project, false, await readAiSiteCustomPages(project).catch(() => []));
        if (!html.trim())
            return null;
        const dir = aiSectionRevisionDir(project.id, sectionKey);
        await mkdir(dir, { recursive: true });
        const stamp = `${Date.now()}_${cleanAiSiteRevisionReason(reason)}.html`;
        const revisionFile = path.join(dir, stamp);
        await writeFile(revisionFile, html, "utf8");
        const entries = (await readdir(dir).catch(() => []))
            .filter((name) => name.endsWith(".html"))
            .sort();
        const overflow = entries.slice(0, Math.max(0, entries.length - 20));
        await Promise.all(overflow.map((name) => rm(path.join(dir, name), { force: true })));
        return revisionFile;
    }
    async function writeAiSiteSectionHtml(project, sectionKey, html, reason = "edit") {
        await ensureAiSiteSandbox(project);
        await snapshotAiSiteSection(project, sectionKey, reason);
        await writeFile(aiSectionFile(project.id, sectionKey), html, "utf8");
    }
    async function undoAiSiteSectionHtml(project, sectionKey) {
        const dir = aiSectionRevisionDir(project.id, sectionKey);
        const entries = (await readdir(dir).catch(() => []))
            .filter((name) => name.endsWith(".html"))
            .sort();
        const latest = entries.at(-1);
        if (!latest)
            throw new Error("No undo snapshot is available for this section.");
        const revisionFile = path.join(dir, latest);
        const html = await readFile(revisionFile, "utf8");
        await writeFile(aiSectionFile(project.id, sectionKey), html, "utf8");
        await rm(revisionFile, { force: true });
        return { html, revision: latest };
    }
    async function fileExists(file) {
        try {
            await access(file);
            return true;
        }
        catch {
            return false;
        }
    }
    function sectionArray(value) {
        return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 24) : [];
    }
    async function readJsonFile(file, fallback) {
        try {
            return JSON.parse(await readFile(file, "utf8"));
        }
        catch {
            return fallback;
        }
    }
    function uniqueCleanStrings(values, max = 12) {
        const seen = new Set();
        const result = [];
        for (const value of values) {
            const item = cleanHtml(String(value ?? "").replace(/\s+/g, " ")).trim();
            if (!item || seen.has(item.toLowerCase()))
                continue;
            seen.add(item.toLowerCase());
            result.push(item.slice(0, 140));
            if (result.length >= max)
                break;
        }
        return result;
    }
    function stripAiReferenceHtml(html) {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
            .replace(/<!--[\s\S]*?-->/g, " ");
    }
    function decodeBasicHtmlEntities(value) {
        const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
        return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
            const key = String(entity).toLowerCase();
            if (key.startsWith("#x"))
                return String.fromCharCode(parseInt(key.slice(2), 16) || 32);
            if (key.startsWith("#"))
                return String.fromCharCode(parseInt(key.slice(1), 10) || 32);
            return named[key] || " ";
        });
    }
    function textFromHtml(value) {
        return cleanHtml(decodeBasicHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ")).trim();
    }
    function htmlAttrValues(html, attr) {
        const pattern = new RegExp(`\\s${attr}\\s*=\\s*([\"'])(.*?)\\1`, "gi");
        const values = [];
        let match;
        while ((match = pattern.exec(html)) && values.length < 80)
            values.push(decodeBasicHtmlEntities(match[2] || ""));
        return values;
    }
    function htmlTagTexts(html, tagPattern, max = 12) {
        const pattern = new RegExp(`<${tagPattern}\\b[^>]*>([\\s\\S]*?)<\\/${tagPattern.split("|")[0]}>`, "gi");
        const values = [];
        let match;
        while ((match = pattern.exec(html)) && values.length < max * 2)
            values.push(textFromHtml(match[1] || ""));
        return uniqueCleanStrings(values, max);
    }
    function extractAiReferenceMeta(html, name) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`<meta\\b(?=[^>]*(?:name|property)=["']${escaped}["'])(?=[^>]*content=(["'])(.*?)\\1)[^>]*>`, "i");
        return textFromHtml(pattern.exec(html)?.[2] || "");
    }
    function extractAiReferenceColors(html) {
        const colors = [
            ...(html.match(/#[0-9a-f]{3,8}\b/gi) || []),
            ...(html.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi) || [])
        ];
        const counts = new Map();
        for (const raw of colors) {
            const color = raw.toUpperCase();
            counts.set(color, (counts.get(color) || 0) + 1);
        }
        return [...counts.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([color]) => color)
            .filter((color) => !/^#(?:FFF|FFFFFF|000|000000)$/i.test(color))
            .slice(0, 10);
    }
    function extractAiReferenceTypographyHints(html) {
        const hints = [
            ...htmlAttrValues(html, "class").filter((item) => /serif|sans|font|display|headline|condensed|bold|light/i.test(item)),
            ...(html.match(/font-family\s*:\s*([^;}"']+)/gi) || []).map((item) => item.replace(/font-family\s*:/i, "").trim())
        ];
        return uniqueCleanStrings(hints, 8);
    }
    function extractAiReferenceSectionHints(html) {
        const values = [
            ...htmlAttrValues(html, "id"),
            ...htmlAttrValues(html, "class")
                .join(" ")
                .split(/\s+/)
                .filter((item) => /topbar|header|nav|hero|banner|product|category|application|solution|case|about|blog|news|contact|footer|cta|inquiry|service|gallery|timeline|faq/i.test(item))
        ];
        return uniqueCleanStrings(values, 18);
    }
    function aiReferenceLayoutNotes(html, sectionHints) {
        const source = html.toLowerCase();
        const notes = [];
        if (/topbar|header/.test(sectionHints.join(" ")))
            notes.push("Header includes a clear navigation/top information area.");
        if (/dropdown|mega-menu|submenu/.test(source))
            notes.push("Navigation likely uses dropdown or mega-menu behavior.");
        if (/hero|banner|swiper|slide|carousel/.test(source))
            notes.push("Hero area appears visually prominent, possibly image or slider driven.");
        if (/product|category|catalog/.test(sectionHints.join(" ")))
            notes.push("Products are organized through category/catalog modules.");
        if (/blog|news/.test(sectionHints.join(" ")))
            notes.push("Blog/news content appears as a separate editorial listing module.");
        if (/contact|inquiry|form/.test(sectionHints.join(" ")))
            notes.push("Contact/inquiry conversion path is visible.");
        if (/grid|row|col-|columns|flex/.test(source))
            notes.push("Layout uses grid/flex card groupings rather than plain text flow.");
        if (/animation|transition|transform|swiper|slick|owl-carousel/.test(source))
            notes.push("Site likely uses motion/slider interactions; keep generated motion lightweight and export-safe.");
        return uniqueCleanStrings(notes.length ? notes : ["Use this reference only as layout/style inspiration, not as copied content."], 10);
    }
    function normalizedAiReferenceUrls(value) {
        return normalizeStringArray(value)
            .flatMap((item) => item.split(/\s+/))
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => (/^https?:\/\//i.test(item) ? item : `https://${item}`))
            .filter((item, index, list) => list.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
            .slice(0, 3);
    }
    function isPrivateIpAddress(address) {
        if (net.isIPv4(address)) {
            const [a, b] = address.split(".").map(Number);
            return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
        }
        if (net.isIPv6(address)) {
            const lower = address.toLowerCase();
            return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
        }
        return false;
    }
    async function assertSafeAiReferenceUrl(input) {
        let parsed;
        try {
            parsed = new URL(input);
        }
        catch {
            throw new Error("Invalid reference URL");
        }
        if (!["http:", "https:"].includes(parsed.protocol))
            throw new Error("Only http/https reference URLs are allowed");
        const host = parsed.hostname.toLowerCase();
        if (!host || host === "localhost" || host.endsWith(".local"))
            throw new Error("Local reference URLs are blocked");
        if (net.isIP(host) && isPrivateIpAddress(host))
            throw new Error("Private IP reference URLs are blocked");
        if (!net.isIP(host)) {
            const records = await lookup(host, { all: true }).catch(() => []);
            if (records.some((item) => isPrivateIpAddress(item.address)))
                throw new Error("Reference URL resolves to a private network address");
        }
        return parsed.toString();
    }
    async function analyzeAiSiteReferenceUrl(input) {
        const fetchedAt = new Date().toISOString();
        try {
            const safeUrl = await assertSafeAiReferenceUrl(input);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(safeUrl, {
                    redirect: "manual",
                    signal: controller.signal,
                    headers: {
                        accept: "text/html,application/xhtml+xml",
                        "user-agent": "GoodJob-AI-Site-Reference-Analyzer/1.0"
                    }
                });
                const contentType = response.headers.get("content-type") || "";
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                if (!/text\/html|application\/xhtml\+xml/i.test(contentType))
                    throw new Error(`Unsupported content-type: ${contentType || "unknown"}`);
                const raw = (await response.text()).slice(0, 350000);
                const stripped = stripAiReferenceHtml(raw);
                const title = textFromHtml(raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || new URL(safeUrl).hostname;
                const description = extractAiReferenceMeta(raw, "description") || extractAiReferenceMeta(raw, "og:description");
                const headings = htmlTagTexts(stripped, "h[1-3]", 12);
                const navLabels = uniqueCleanStrings((raw.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) || []).map((item) => textFromHtml(item)), 14);
                const sectionHints = extractAiReferenceSectionHints(raw);
                const colors = extractAiReferenceColors(raw);
                const typographyHints = extractAiReferenceTypographyHints(raw);
                const layoutNotes = aiReferenceLayoutNotes(raw, sectionHints);
                const warnings = [
                    response.status >= 300 && response.status < 400 ? "Reference returned a redirect; fetch did not follow it for safety." : "",
                    colors.length < 2 ? "Few colors were discoverable from inline HTML; screenshot analysis may improve this later." : "",
                    "Use as inspiration only. Do not copy exact text, images, code, logos, or brand assets."
                ].filter(Boolean);
                return {
                    url: input,
                    finalUrl: safeUrl,
                    status: "ready",
                    fetchedAt,
                    title,
                    description,
                    headings,
                    navLabels,
                    sectionHints,
                    colors,
                    typographyHints,
                    layoutNotes,
                    warnings
                };
            }
            finally {
                clearTimeout(timer);
            }
        }
        catch (error) {
            return {
                url: input,
                finalUrl: input,
                status: "failed",
                fetchedAt,
                title: "",
                description: "",
                headings: [],
                navLabels: [],
                sectionHints: [],
                colors: [],
                typographyHints: [],
                layoutNotes: [],
                warnings: ["Reference site could not be analyzed. The URL will remain a weak style hint only."],
                error: error instanceof Error ? error.message : "Reference analysis failed"
            };
        }
    }
    function buildAiSiteReferenceBrief(sites) {
        const ready = sites.filter((site) => site.status === "ready");
        if (!ready.length)
            return "";
        const lines = [
            "Reference design context contract: use these analyzed sites only as layout/style inspiration. Do not copy exact text, images, code, logos, or brand-owned visual assets.",
            ...ready.map((site, index) => [
                `Reference ${index + 1}: ${site.title || site.finalUrl} (${site.finalUrl})`,
                site.description ? `- Positioning: ${site.description.slice(0, 220)}` : "",
                site.colors.length ? `- Extracted palette clues: ${site.colors.slice(0, 8).join(", ")}` : "",
                site.navLabels.length ? `- Navigation/content labels: ${site.navLabels.slice(0, 10).join(" / ")}` : "",
                site.headings.length ? `- Heading rhythm: ${site.headings.slice(0, 6).join(" / ")}` : "",
                site.sectionHints.length ? `- Section/layout signals: ${site.sectionHints.slice(0, 12).join(" / ")}` : "",
                site.layoutNotes.length ? `- Layout notes: ${site.layoutNotes.join(" ")}` : "",
                site.typographyHints.length ? `- Typography clues: ${site.typographyHints.slice(0, 5).join(" / ")}` : ""
            ].filter(Boolean).join("\n"))
        ];
        return lines.join("\n").slice(0, 6000);
    }
    async function readAiSiteReferenceSites(project) {
        await ensureAiSiteSandbox(project);
        const fallback = { version: "ai-site-reference-sites.v1", updatedAt: "", sites: [], brief: "" };
        const stored = await readJsonFile(aiSiteReferenceSitesFile(project.id), fallback);
        return {
            version: stored.version || fallback.version,
            updatedAt: stored.updatedAt || "",
            sites: Array.isArray(stored.sites) ? stored.sites : [],
            brief: typeof stored.brief === "string" ? stored.brief : ""
        };
    }
    async function writeAiSiteReferenceSites(project, sites) {
        await ensureAiSiteSandbox(project);
        const state = {
            version: "ai-site-reference-sites.v1",
            updatedAt: new Date().toISOString(),
            sites,
            brief: buildAiSiteReferenceBrief(sites)
        };
        await writeFile(aiSiteReferenceSitesFile(project.id), JSON.stringify(state, null, 2), "utf8");
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const agentPayload = normalizeAgentPayload(project.agentPayload, schema, project.pages || []);
        project.agentPayload = {
            ...agentPayload,
            reference_design_context: state.brief,
            reference_sites_analysis: {
                version: state.version,
                updatedAt: state.updatedAt,
                sites: sites.map((site) => ({
                    url: site.url,
                    status: site.status,
                    title: site.title,
                    colors: site.colors,
                    sectionHints: site.sectionHints,
                    error: site.error
                }))
            }
        };
        await writeFile(aiProjectMetaFile(project.id), JSON.stringify(project, null, 2), "utf8");
        return state;
    }
    function aiSiteReferenceDesignContext(project) {
        const payload = project.agentPayload && typeof project.agentPayload === "object" ? project.agentPayload : {};
        const context = payload.reference_design_context;
        return typeof context === "string" ? context.trim().slice(0, 6000) : "";
    }
    function cleanAiSiteCustomPageLabel(value, fallback = "New Page") {
        const label = String(value ?? "").replace(/\s+/g, " ").trim();
        return (label || fallback).slice(0, 80);
    }
    async function readAiSiteCustomPages(project) {
        const pages = await readJsonFile(aiSiteCustomPagesFile(project.id), []);
        return pages
            .filter((item) => item && isAiSiteSectionKey(item.key) && !aiSiteSectionKeys.includes(item.key))
            .map((item) => ({ key: item.key, label: cleanAiSiteCustomPageLabel(item.label, "Custom Page"), createdAt: item.createdAt || new Date().toISOString() }));
    }
    async function writeAiSiteCustomPages(project, pages) {
        await mkdir(aiProjectDir(project.id), { recursive: true });
        await writeFile(aiSiteCustomPagesFile(project.id), JSON.stringify(pages, null, 2), "utf8");
    }
    function aiSiteSectionLabel(sectionKey, customPages = []) {
        return aiSiteSectionLabels[sectionKey] || customPages.find((item) => item.key === sectionKey)?.label || "Custom Page";
    }
    function aiSiteSectionBlueprint(sectionKey, blueprint, customPages = []) {
        if (blueprint[sectionKey])
            return blueprint[sectionKey];
        const label = aiSiteSectionLabel(sectionKey, customPages);
        if (!aiSiteSectionKeys.includes(sectionKey)) {
            return `Custom page: ${label}. Use this page as a simple editable section that can later be generated or rewritten by the agent.`;
        }
        return sectionKey === "header" || sectionKey === "footer" ? "Fixed global component, generated automatically and locked." : "";
    }
    function aiSiteBlueprint(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const company = schema.company_profile;
        const taxonomy = schema.business_taxonomy;
        const style = schema.style_requirements;
        const siteName = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
        const categories = sectionArray(taxonomy.product_categories);
        const styleWords = sectionArray(style.keywords).join("、") || style.preset;
        return {
            hero: `首屏突出 ${siteName} 的跨境工业品牌可信度，展示核心产品、交付能力和询盘入口，视觉风格：${styleWords}。`,
            products: `产品区块聚焦 ${categories.join("、") || "核心工业产品"}，用卡片展示类别、典型参数和快速询盘入口。`,
            applications: `应用区块围绕 ${categories.join("、") || "典型工业应用场景"} 展开，说明客户痛点、应用场景和适配产品。`,
            about_us: `关于我们区块介绍 ${company.legal_name || siteName} 的成立背景、制造能力、质量体系和外贸服务能力。`,
            blog: "博客区块用于承接产品知识、选型指南、行业洞察和SEO长尾流量。",
            contact_us: "联系区块提供电话、邮箱、地址、社媒矩阵和询盘表单 CTA，降低询盘阻力。"
        };
    }
    function cleanAiSiteBlueprint(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const company = schema.company_profile;
        const taxonomy = schema.business_taxonomy;
        const style = schema.style_requirements;
        const siteName = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
        const categories = sectionArray(taxonomy.product_categories);
        const styleWords = sectionArray(style.keywords).join(", ") || style.preset || "professional";
        return {
            header: "Render the fixed B2B topbar, navigation, product dropdown, and inquiry CTA using the company brand and product categories.",
            hero: `Open with a credible industrial B2B value proposition for ${siteName}. Show product strength, export readiness, delivery capability, and a clear inquiry CTA. Visual style: ${styleWords}.`,
            products: `Present ${categories.join(", ") || "core industrial product categories"} with category cards, practical specifications, buyer benefits, and inquiry entry points.`,
            applications: `Explain application scenarios for ${categories.join(", ") || "the core product categories"} by pairing buyer pain points, operating environments, and suitable products.`,
            about_us: `Introduce ${company.legal_name || siteName} with manufacturing capability, quality control, export service process, and long-term reliability.`,
            blog: "Provide SEO-ready article cards for product knowledge, selection guides, maintenance tips, and industrial market insights.",
            contact_us: "Provide phone, email, location, social links, and an inquiry CTA that makes it easy for international buyers to contact the supplier.",
            footer: "Render the fixed B2B footer with brand summary, product categories, contact information, copyright, and a back-to-top link."
        };
    }
    function cleanHexColor(value, fallback) {
        const color = value.trim();
        if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))
            return fallback;
        if (color.length === 4)
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toUpperCase();
        return color.toUpperCase();
    }
    function isHexColorString(value) {
        return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
    }
    function splitAiSiteNaturalList(values) {
        return values
            .flatMap((value) => (typeof value === "string" ? value.split(/[\n,，;；、]+/u) : []))
            .map((value) => value.trim())
            .filter(Boolean);
    }
    function aiSiteTextIncludesAny(text, terms) {
        const source = text.toLowerCase();
        return terms.some((term) => source.includes(term.toLowerCase()));
    }
    function aiSiteStyleIntentFlags(text) {
        return {
            minimal: aiSiteTextIncludesAny(text, ["minimal", "clean", "simple", "white", "light", "\u6781\u7b80", "\u7b80\u6d01", "\u7559\u767d", "\u5e72\u51c0", "\u6e05\u723d"]),
            tech: aiSiteTextIncludesAny(text, ["tech", "future", "cyber", "digital", "ai", "automation", "\u79d1\u6280", "\u672a\u6765", "\u667a\u80fd", "\u6570\u5b57", "\u8d5b\u535a", "\u81ea\u52a8\u5316"]),
            premium: aiSiteTextIncludesAny(text, ["premium", "luxury", "high-end", "editorial", "\u9ad8\u7aef", "\u5962\u534e", "\u8d28\u611f", "\u54c1\u724c", "\u9ad8\u7ea7", "\u7f16\u8f91\u611f"]),
            eco: aiSiteTextIncludesAny(text, ["eco", "green", "sustain", "environment", "\u73af\u4fdd", "\u7eff\u8272", "\u53ef\u6301\u7eed", "\u81ea\u7136"]),
            bold: aiSiteTextIncludesAny(text, ["bold", "strong", "aggressive", "impact", "\u6fc0\u8fdb", "\u5f3a\u70c8", "\u51b2\u51fb", "\u91cd\u5de5", "\u786c\u6717", "\u5927\u80c6"]),
            classic: aiSiteTextIncludesAny(text, ["classic", "traditional", "factory", "industrial-professional", "\u4f20\u7edf", "\u5de5\u5382", "\u7a33\u91cd"]),
            retro: aiSiteTextIncludesAny(text, ["retro", "vintage", "y2k", "millennium", "old web", "web 1.0", "classic web", "\u590d\u53e4", "\u5343\u79a7", "\u5343\u79a7\u5e74", "\u5e74\u4ee3\u611f", "\u8001\u7f51\u9875", "\u53e4\u65e9", "\u6000\u65e7"])
        };
    }
    function aiSiteNamedColorPalette(values) {
        const text = values.join(" ").toLowerCase();
        const definitions = [
            { pattern: /green|emerald|teal|\u7eff|\u7eff\u8272|\u9752\u7eff|\u58a8\u7eff|\u7fe1\u7fe0/i, color: "#0F766E" },
            { pattern: /blue|cyan|azure|\u84dd|\u84dd\u8272|\u5929\u84dd|\u6e56\u84dd|\u975b\u84dd/i, color: "#2563EB" },
            { pattern: /white|ivory|cream|\u767d|\u767d\u8272|\u7c73\u767d|\u8c61\u7259/i, color: "#F8FAFC" },
            { pattern: /black|charcoal|\u9ed1|\u9ed1\u8272|\u70ad\u9ed1/i, color: "#111827" },
            { pattern: /red|crimson|\u7ea2|\u7ea2\u8272|\u8d64/i, color: "#DC2626" },
            { pattern: /orange|\u6a59|\u6a59\u8272/i, color: "#F97316" },
            { pattern: /yellow|gold|\u9ec4|\u9ec4\u8272|\u91d1|\u91d1\u8272/i, color: "#D97706" },
            { pattern: /purple|violet|\u7d2b|\u7d2b\u8272/i, color: "#7C3AED" },
            { pattern: /gray|grey|silver|\u7070|\u7070\u8272|\u94f6/i, color: "#64748B" },
            { pattern: /绿|绿色|青绿|墨绿|翡翠|green|emerald|teal/u, color: "#0F766E" },
            { pattern: /蓝|蓝色|天蓝|湖蓝|靛蓝|blue|cyan|azure/u, color: "#2563EB" },
            { pattern: /白|白色|米白|象牙|white|ivory|cream/u, color: "#F8FAFC" },
            { pattern: /黑|黑色|black|charcoal/u, color: "#111827" },
            { pattern: /红|红色|red|crimson/u, color: "#DC2626" },
            { pattern: /橙|橘|橙色|orange/u, color: "#F97316" },
            { pattern: /黄|金|黄色|金色|yellow|gold/u, color: "#D97706" },
            { pattern: /紫|紫色|purple|violet/u, color: "#7C3AED" },
            { pattern: /灰|灰色|银|gray|grey|silver/u, color: "#64748B" }
        ];
        const colors = [];
        for (const definition of definitions) {
            if (definition.pattern.test(text) && !colors.includes(definition.color))
                colors.push(definition.color);
        }
        return colors;
    }
    function resolveAiSitePaletteColors(colors) {
        const naturalColors = splitAiSiteNaturalList(colors);
        const explicitHex = naturalColors.filter(isHexColorString).map((color) => cleanHexColor(color, "#000000"));
        return explicitHex.length ? explicitHex : aiSiteNamedColorPalette(naturalColors.length ? naturalColors : colors);
    }
    function hexToRgb(color) {
        const clean = cleanHexColor(color, "#000000").slice(1);
        return {
            r: parseInt(clean.slice(0, 2), 16),
            g: parseInt(clean.slice(2, 4), 16),
            b: parseInt(clean.slice(4, 6), 16)
        };
    }
    function rgbToHex(r, g, b) {
        return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    }
    function mixHexColor(color, target, amount) {
        const from = hexToRgb(color);
        const to = hexToRgb(target);
        return rgbToHex(from.r + (to.r - from.r) * amount, from.g + (to.g - from.g) * amount, from.b + (to.b - from.b) * amount);
    }
    function readableTextOn(color) {
        const { r, g, b } = hexToRgb(color);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.62 ? "#16202E" : "#FFFFFF";
    }
    function aiSiteStyleProfile(project, palette) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const style = schema.style_requirements;
        const keywords = sectionArray(style.keywords);
        const referenceSites = sectionArray(style.reference_sites);
        const text = `${style.preset || project.tone || ""} ${keywords.join(" ")} ${style.custom_notes || ""}`.toLowerCase();
        const intent = aiSiteStyleIntentFlags(text);
        const isMinimal = /minimal|clean|simple|white|light|极简|简洁|留白/.test(text);
        const isTech = /tech|future|cyber|digital|ai|automation|科技|未来|智能|数字/.test(text);
        const isPremium = /premium|luxury|high-end|editorial|高端|奢华|质感|品牌/.test(text);
        const isEco = /eco|green|sustain|environment|环保|绿色|可持续/.test(text);
        const isBold = /bold|strong|aggressive|impact|激进|强烈|冲击|重工业/.test(text);
        const isClassic = /classic|traditional|factory|industrial-professional|传统|工厂|稳重/.test(text);
        const cnMinimal = /极简|简洁|留白|干净|清爽/.test(text);
        const cnTech = /科技|未来|智能|数字|赛博|自动化/.test(text);
        const cnPremium = /高端|奢华|质感|品牌|高级|编辑感/.test(text);
        const cnEco = /环保|绿色|可持续|自然/.test(text);
        const cnBold = /激进|强烈|冲击|重工|硬朗|大胆/.test(text);
        const wantsMinimal = isMinimal || cnMinimal || intent.minimal;
        const wantsTech = isTech || cnTech || intent.tech;
        const wantsPremium = isPremium || cnPremium || intent.premium;
        const wantsEco = isEco || cnEco || intent.eco;
        const wantsBold = isBold || cnBold || intent.bold;
        const wantsRetro = /retro|vintage|y2k|millennium|old\s*web|web\s*1\.0|classic\s*web|复古|千禧|千禧年|年代感|老网页|古早|怀旧|可靠/u.test(text);
        const wantsRetroProfile = wantsRetro || intent.retro;
        const mood = wantsRetroProfile ? "retro Y2K reliable web" : wantsTech ? "technical futuristic" : wantsEco ? "clean sustainable" : wantsPremium ? "premium editorial" : wantsMinimal ? "minimal precision" : wantsBold ? "bold industrial" : "professional industrial";
        const density = wantsRetroProfile ? "compact-layered" : wantsMinimal || wantsPremium ? "spacious" : wantsTech || wantsBold ? "dense-but-layered" : "balanced";
        const shape = wantsRetroProfile ? "boxed" : wantsTech || wantsBold ? "sharp" : wantsMinimal || wantsEco ? "soft" : "industrial";
        const background = wantsTech
            ? "dark-to-light technical gradients, subtle grid lines, data-like accents"
            : wantsRetroProfile
                ? "green-blue-white old-web surfaces, visible borders, boxed panels, modest shadows, nostalgic but readable contrast"
                : wantsEco
                    ? "light surfaces, green-tinted bands, natural whitespace, soft dividers"
                    : wantsPremium
                        ? "deep editorial contrast, large quiet whitespace, refined accent lines"
                        : wantsMinimal
                            ? "white and near-white bands, thin rules, sparse cards"
                            : wantsBold
                                ? "high-contrast dark bands, strong diagonal or stepped panels"
                                : "industrial navy/steel bands with controlled accent details";
        const composition = wantsTech
            ? "layered dashboards, timeline rails, spec chips, glow-free technical surfaces"
            : wantsRetroProfile
                ? "old-web inspired vertical rhythm with framed headers, bordered category groups, compact badges, and table-like proof modules"
                : wantsEco
                    ? "breathing vertical sections, soft proof bands, rounded product/category panels"
                    : wantsPremium
                        ? "editorial asymmetry, oversized type, restrained cards, magazine-like feature blocks"
                        : wantsMinimal
                            ? "single-column clarity, whitespace-first layouts, thin dividers, compact proof rows"
                            : wantsBold
                                ? "large blocks, strong hierarchy, stepped grids, dark proof strips"
                                : "B2B industrial rhythm with varied vertical sections and practical proof modules";
        const ctaStyle = wantsRetroProfile ? "boxed retro" : wantsMinimal || wantsEco ? "clean rounded" : wantsTech || wantsBold ? "sharp high-contrast" : wantsPremium ? "refined editorial" : "industrial rectangular";
        const avoid = [
            "do not force the old navy/red palette if form colors or style words point elsewhere",
            "do not repeat the same heading plus 3-card grid in every section",
            wantsMinimal ? "avoid heavy dark blocks and noisy technical decoration" : "",
            wantsTech ? "avoid beige, soft corporate SaaS cards, and generic factory brochure layout" : "",
            wantsPremium ? "avoid crowded grids and cheap badge-heavy styling" : "",
            wantsEco ? "avoid harsh black/red aggression unless supplied by user colors" : "",
            wantsBold ? "avoid pale low-contrast minimal pages" : "",
            wantsRetroProfile ? "avoid sleek modern SaaS cards, glassmorphism, and the default blue industrial template" : ""
        ].filter(Boolean);
        return {
            mood,
            density,
            shape,
            background,
            composition,
            ctaStyle,
            keywords,
            customNotes: style.custom_notes || "",
            referenceSites,
            avoid,
            palette,
            summary: `${mood}; ${density}; ${shape} geometry; ${background}; ${composition}`
        };
    }
    function aiSiteDesignSystem(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const style = schema.style_requirements;
        const rawColors = sectionArray(style.colors);
        let colors = resolveAiSitePaletteColors(rawColors);
        const preset = (style.preset || project.tone || "industrial-professional").toLowerCase();
        const naturalKeywords = splitAiSiteNaturalList(sectionArray(style.keywords));
        const styleText = `${preset} ${naturalKeywords.join(" ")} ${style.custom_notes || ""} ${rawColors.join(" ")}`.toLowerCase();
        const intent = aiSiteStyleIntentFlags(styleText);
        if (!colors.length && intent.retro) {
            colors = ["#0F766E", "#2563EB", "#F8FAFC"];
        }
        if (!colors.length && /retro|vintage|y2k|millennium|old\s*web|web\s*1\.0|复古|千禧|千禧年|年代感|老网页|古早|怀旧/u.test(styleText)) {
            colors = ["#0F766E", "#2563EB", "#F8FAFC"];
        }
        const fallbackPalette = /minimal|clean|极简|简洁|留白|干净|清爽/.test(styleText)
            ? ["#2563EB", "#0EA5E9", "#F8FAFC"]
            : /tech|future|cyber|科技|未来|智能|数字|赛博|自动化/.test(styleText)
                ? ["#4F46E5", "#06B6D4", "#F5F3FF"]
                : /eco|green|sustainable|环保|绿色|可持续|自然/.test(styleText)
                    ? ["#0F766E", "#F97316", "#F0FDFA"]
                    : /luxury|premium|high-end|editorial|高端|奢华|质感|品牌|高级|编辑感/.test(styleText)
                        ? ["#111827", "#D97706", "#F8FAFC"]
                        : ["#143A7B", "#C8161C", "#F4F6FA"];
        const intentFallbackPalette = intent.minimal
            ? ["#2563EB", "#0EA5E9", "#F8FAFC"]
            : intent.tech
                ? ["#4F46E5", "#06B6D4", "#F5F3FF"]
                : intent.eco
                    ? ["#0F766E", "#F97316", "#F0FDFA"]
                    : intent.premium
                        ? ["#111827", "#D97706", "#F8FAFC"]
                        : intent.retro
                            ? ["#0F766E", "#2563EB", "#F8FAFC"]
                            : fallbackPalette;
        const brand = cleanHexColor(colors[0] || "", intentFallbackPalette[0]);
        const accent = cleanHexColor(colors[1] || "", intentFallbackPalette[1]);
        const surface = cleanHexColor(colors[2] || "", intentFallbackPalette[2]);
        const brandDeep = cleanHexColor(colors[3] || "", mixHexColor(brand, "#000000", 0.54));
        const brandWide = mixHexColor(brand, "#FFFFFF", 0.14);
        const dark = cleanHexColor(colors[4] || "", mixHexColor(brandDeep, "#000000", 0.28));
        const styleProfile = aiSiteStyleProfile(project, { brand, accent, surface, brandDeep, brandWide, dark });
        return {
            version: "ai-site-design-system.v2-xinhai-industrial",
            preset: style.preset || project.tone || "industrial-professional",
            styleProfile,
            palette: {
                brand,
                accent,
                brandDeep,
                brandWide,
                ink: "#16202E",
                body: "#3C4858",
                muted: "#6B7686",
                line: "#E2E7EE",
                surface,
                steel: "#EAEEF4",
                dark,
                light: "#ffffff"
            },
            typography: {
                family: "Barlow, Inter, Arial, sans-serif",
                displayFamily: "Barlow Semi Condensed, Barlow, Arial, sans-serif",
                h1: "clamp(40px,5.4vw,72px)",
                h2: "clamp(30px,3.6vw,46px)",
                body: "clamp(16px,1.2vw,17px)",
                lineHeight: "1.72"
            },
            layout: {
                wrapper: "width:min(1280px,calc(100vw - clamp(32px,6vw,120px)));margin:auto",
                sectionPadding: "96px 0 desktop, 64px 0 mobile",
                gap: "clamp(18px,3vw,32px)",
                grid: "repeat(auto-fit,minmax(min(280px,100%),1fr))",
                mobileBreakpoint: "760px",
                tabletBreakpoint: "1080px",
                wideBreakpoint: "1200px",
                fixedModules: ["topbar", "sticky-header", "hero-slider-look", "hero-stats-strip", "section-head", "card-grid", "cta-band", "footer"]
            },
            components: {
                cardRadius: styleProfile.shape === "soft" ? "12px" : styleProfile.shape === "sharp" ? "2px" : "6px",
                cardBorder: "1px solid #E2E7EE",
                shadow: "0 24px 60px rgba(16,32,60,.16)",
                buttonRadius: styleProfile.shape === "soft" ? "999px" : styleProfile.shape === "sharp" ? "2px" : "6px",
                primaryButton: `${styleProfile.ctaStyle} CTA with arrow icon`,
                secondaryButton: "transparent or white outlined rectangular CTA"
            },
            icons: {
                sprite: "inline SVG symbols injected by framework",
                allowedIds: ["icon-location", "icon-phone", "icon-mail", "icon-linkedin", "icon-youtube", "icon-facebook", "icon-arrow-right", "icon-cube", "icon-globe", "icon-expertise", "icon-building", "icon-check", "icon-send"]
            },
            rules: [
                "Use the same palette and spacing tokens in every section, but vary section composition according to the style profile.",
                `Style profile: ${styleProfile.summary}`,
                "Every generated business section must include one scoped style tag as its first child.",
                "Selectors must be prefixed with the current section id.",
                "Use semantic section/article/list markup that can become a WordPress block.",
                "Use <svg><use href=\"#icon-name\"></use></svg> for framework icons instead of inventing new icon paths.",
                "Avoid unscoped .container, .grid, .card, body, html, :root, header, footer selectors."
            ]
        };
    }
    function aiSiteSectionVariantRegistry() {
        return {
            header: [{
                    id: "locked_fixed_header",
                    title: "Locked B2B Header",
                    purpose: "Global topbar, navigation, product dropdown, and inquiry CTA shared by every route.",
                    wpTarget: "template-parts/header.html",
                    structure: ["topbar contact/social strip", "brand wordmark", "fixed navigation", "Products dropdown from product_categories", "mobile menu button", "inquiry CTA"],
                    interactions: ["mobile menu toggle", "product dropdown hover/focus", "WP route links generated by route map"],
                    editableData: ["brand", "contact_info", "social_links", "product_categories", "nav labels"],
                    visualTokens: ["brand", "accent", "brandDeep", "line", "light"],
                    animation: "subtle dropdown and mobile menu only",
                    responsive: "desktop horizontal nav; mobile collapses into menu while labels never wrap",
                    avoid: ["CRM links", "logout/login controls", "hard-coded local domain", "duplicated page anchors in WP export"]
                }],
            hero: [{
                    id: "darkened_photo_hero_slider",
                    title: "Darkened Photo Hero Slider",
                    purpose: "High-impact first viewport with brand-specific headline, three background images, clear CTA pair, and later image-upload hooks.",
                    wpTarget: "blocks/hero-photo-slider",
                    structure: ["72vh photo stage", "dark overlay", "eyebrow", "two-line H1", "subtitle", "Request a Proposal CTA", "Learn More CTA", "bottom-right slider controls"],
                    interactions: ["CSS radio fallback", "6-second auto switch enhanced by theme JS", "future hero background upload slots"],
                    editableData: ["headline", "subtitle", "eyebrow", "button labels", "background images"],
                    visualTokens: ["brandDeep overlay", "accent CTA", "white text", "imageTreatment: full-bleed darkened"],
                    animation: "background cross-fade and subtle CTA hover",
                    responsive: "fixed 72vh stage; H1 max two visual lines; controls stay bottom-right on desktop and compact on mobile",
                    avoid: ["extra metrics", "cards", "side panels", "product grids", "generic Industrial... headline"]
                }, {
                    id: "technical_banner_focus",
                    title: "Technical Banner Focus",
                    purpose: "A calmer hero variant for precision or minimal styles with lighter overlay and tighter proof chips.",
                    wpTarget: "blocks/hero-technical-banner",
                    structure: ["banner image", "headline", "subtitle", "two CTAs", "small proof chips"],
                    interactions: ["button hover", "optional static background upload slot"],
                    editableData: ["headline", "subtitle", "proof chips", "background image"],
                    visualTokens: ["surface", "brand", "accent", "thin rules"],
                    animation: "light reveal only",
                    responsive: "reflows into single-column banner on mobile",
                    avoid: ["dark heavy treatment when style asks for minimal precision", "busy metrics strip"]
                }],
            products: [{
                    id: "product_category_tabs_catalog_slider",
                    title: "Category Tabs Catalog Slider",
                    purpose: "Product-category-first browsing with card previews that later map cleanly to product CPT archive/query data.",
                    wpTarget: "blocks/products-category-catalog",
                    structure: ["Product Category heading", "intro copy", "category buttons", "active-category product cards", "left/right browsing arrows"],
                    interactions: ["data-product-category button switching", "radio fallback pages", "card inquiry links to contact"],
                    editableData: ["product_categories", "product CPT items", "product images", "category descriptions"],
                    visualTokens: ["surface cards", "brand active tab", "accent arrows", "product image ratio"],
                    animation: "tab switch and card hover lift",
                    responsive: "4-card desktop stage; 2-column tablet; 1-column mobile with arrows hidden",
                    avoid: ["plain 3-card grid", "spec matrix only", "hard-split backgrounds", "inert category spans", "href=#"]
                }, {
                    id: "category_sidebar_grid",
                    title: "Sidebar Category Grid",
                    purpose: "Archive-like product browsing with category rail and dense product grid for larger catalogs.",
                    wpTarget: "blocks/products-sidebar-grid",
                    structure: ["left category rail", "right product grid", "featured category intro", "RFQ CTA"],
                    interactions: ["category filter buttons", "product card links", "sticky category rail on desktop"],
                    editableData: ["product_categories", "product CPT items", "featured category"],
                    visualTokens: ["brand sidebar", "light card grid", "accent hover"],
                    animation: "card hover and category active state",
                    responsive: "category rail becomes horizontal scroll on mobile",
                    avoid: ["small unreadable product cards", "one product per row on desktop"]
                }],
            applications: [{
                    id: "applications_horizontal_card_preview",
                    title: "Horizontal Scenario Cards",
                    purpose: "Scenario-driven application preview that separates buyer context from product catalog browsing.",
                    wpTarget: "blocks/applications-scenario-map",
                    structure: ["title block", "horizontal scenario card row", "pain point", "suitable product chip", "outcome", "CTA"],
                    interactions: ["horizontal scroll/snap", "CTA links to contact/products", "card hover focus"],
                    editableData: ["application scenarios", "pain points", "product/category mapping", "outcomes"],
                    visualTokens: ["continuous background", "card surface", "contrast-safe text", "brand chips"],
                    animation: "horizontal preview scroll and hover border accent",
                    responsive: "desktop horizontal preview; mobile single-column or horizontal snap with readable cards",
                    avoid: ["hard-split color blocks", "gray text on dark blue", "same product-card layout", "decorative layers over links"]
                }, {
                    id: "industry_matrix",
                    title: "Industry Matrix",
                    purpose: "A structured matrix for industries, environments, recommended products, and RFQ notes.",
                    wpTarget: "blocks/applications-industry-matrix",
                    structure: ["industry tabs", "environment rows", "recommended products", "RFQ notes"],
                    interactions: ["tab buttons", "row hover", "contact CTA"],
                    editableData: ["industries", "environments", "product mapping"],
                    visualTokens: ["table-like lines", "brand tab", "light rows"],
                    animation: "tab reveal only",
                    responsive: "matrix becomes stacked cards on mobile",
                    avoid: ["wide table overflow", "dense unreadable cells"]
                }],
            about_us: [{
                    id: "capability_stack_and_quality_process",
                    title: "Capability Stack + Quality Process",
                    purpose: "Institutional proof section showing capability, documentation, reliability, and process without becoming another product grid.",
                    wpTarget: "blocks/about-capability-stack",
                    structure: ["title block", "capability stack", "documentation/proof card", "reliability note", "quality/export process belt"],
                    interactions: ["CTA to contact", "process item hover"],
                    editableData: ["company profile", "capability items", "proof points", "process steps"],
                    visualTokens: ["continuous background", "dark panel", "white card", "explicit text contrast"],
                    animation: "calm reveal and process hover",
                    responsive: "desktop asymmetric panels; mobile stacked panels with consistent spacing",
                    avoid: ["hard-split backgrounds", "low-contrast dark text on blue", "founder-story-only cards", "oversized decorative badges"]
                }, {
                    id: "timeline_factory_proof",
                    title: "Factory Proof Timeline",
                    purpose: "Chronological proof of growth, factory capability, inspection, and export readiness.",
                    wpTarget: "blocks/about-factory-timeline",
                    structure: ["intro", "timeline", "proof metrics", "quality statement"],
                    interactions: ["timeline hover", "contact CTA"],
                    editableData: ["milestones", "metrics", "factory proof points"],
                    visualTokens: ["timeline rail", "brand dots", "light cards"],
                    animation: "timeline reveal",
                    responsive: "timeline collapses into vertical cards",
                    avoid: ["fake founder story", "unsubstantiated oversized numbers"]
                }],
            blog: [{
                    id: "industrial_editorial_digest",
                    title: "Industrial Editorial Digest",
                    purpose: "SEO-oriented knowledge block with one featured article and compact recent posts.",
                    wpTarget: "blocks/recent-blogs-split",
                    structure: ["RECENT BLOGS title", "large featured post", "More Blogs action", "dated article rows"],
                    interactions: ["article links", "more blogs archive link", "hover underline"],
                    editableData: ["news CPT items", "dates", "categories", "excerpt", "featured image"],
                    visualTokens: ["editorial whitespace", "brand headings", "date muted text", "image ratio"],
                    animation: "article hover and subtle reveal",
                    responsive: "desktop split editorial; mobile one-column list",
                    avoid: ["same product card grid", "fake news clutter", "large equal blocks only"]
                }, {
                    id: "resource_center_index",
                    title: "Resource Center Index",
                    purpose: "Guide-style content index grouped by selection, maintenance, troubleshooting, and export documents.",
                    wpTarget: "blocks/blog-resource-index",
                    structure: ["intent filter chips", "guide cards", "latest insights"],
                    interactions: ["filter chips", "archive CTA"],
                    editableData: ["news CPT items", "intent tags"],
                    visualTokens: ["light cards", "accent chips", "thin dividers"],
                    animation: "chip hover and card lift",
                    responsive: "chips wrap; cards become one column",
                    avoid: ["too many cards above the fold"]
                }],
            contact_us: [{
                    id: "inquiry_command_center",
                    title: "Fixed Inquiry Command Center",
                    purpose: "Conversion-critical contact section with fixed left trust column and right visible inquiry form.",
                    wpTarget: "blocks/contact-inquiry-form",
                    structure: ["left trust/CTA column", "contact channels", "RFQ checklist", "right white form panel", "required fields", "SEND INQUIRY button"],
                    interactions: ["form controls", "mailto/tel fallback", "submit button hover", "future CF7 replacement"],
                    editableData: ["contact_info", "response promise", "form labels", "RFQ checklist"],
                    visualTokens: ["dark trust surface", "white form card", "accent submit", "contrast-safe text"],
                    animation: "form card reveal and button hover",
                    responsive: "desktop two columns; mobile stacks trust column before form",
                    avoid: ["CTA-only contact block", "map placeholder", "footer-style contact grid", "hidden form"]
                }],
            footer: [{
                    id: "locked_fixed_footer",
                    title: "Locked B2B Footer",
                    purpose: "Global footer with brand summary, product links, contact data, social links, and copyright.",
                    wpTarget: "template-parts/footer.html",
                    structure: ["brand summary", "capabilities", "product categories", "contact channels", "copyright bar"],
                    interactions: ["back-to-top link", "social links", "WP route links"],
                    editableData: ["brand", "company description", "product_categories", "contact_info", "social_links"],
                    visualTokens: ["dark footer", "accent icons", "light text"],
                    animation: "none beyond hover",
                    responsive: "four columns desktop; one column mobile",
                    avoid: ["oversized icons", "duplicated header nav", "CRM/system links"]
                }]
        };
    }
    function aiSiteSectionVariantMeta(spec) {
        return {
            id: spec.id,
            title: spec.title,
            purpose: spec.purpose,
            wp_target: spec.wpTarget,
            structure: spec.structure,
            interactions: spec.interactions,
            editable_data: spec.editableData,
            visual_tokens: spec.visualTokens,
            animation: spec.animation,
            responsive: spec.responsive,
            avoid: spec.avoid
        };
    }
    function aiSiteVariantRegistryMeta() {
        const registry = aiSiteSectionVariantRegistry();
        return Object.fromEntries(Object.entries(registry).map(([key, specs]) => [key, specs.map(aiSiteSectionVariantMeta)]));
    }
    function aiSiteDefaultVariantSpec(sectionKey) {
        const registry = aiSiteSectionVariantRegistry();
        if (aiSiteSectionKeys.includes(sectionKey)) {
            return registry[sectionKey]?.[0] || registry.hero[0];
        }
        return {
            id: "custom_simple_page",
            title: "Custom Simple Page",
            purpose: "Editable custom page section that can be promoted to a WordPress pattern or block later.",
            wpTarget: "patterns/custom-simple-page",
            structure: ["custom page heading", "intro copy", "content band", "CTA row"],
            interactions: ["CTA to contact"],
            editableData: ["page title", "intro copy", "body copy", "CTA label"],
            visualTokens: ["surface", "brand", "accent", "line"],
            animation: "basic reveal only",
            responsive: "single-column mobile-safe layout",
            avoid: ["header/footer duplication", "CRM links", "full homepage shell"]
        };
    }
    function aiSiteSelectVariantSpec(project, sectionKey) {
        const base = aiSiteDefaultVariantSpec(sectionKey);
        if (!aiSiteSectionKeys.includes(sectionKey))
            return base;
        const registry = aiSiteSectionVariantRegistry()[sectionKey] || [base];
        const styleProfile = aiSiteDesignSystem(project).styleProfile;
        const text = `${styleProfile.mood} ${styleProfile.summary} ${styleProfile.customNotes} ${styleProfile.keywords.join(" ")}`.toLowerCase();
        if (sectionKey === "hero" && /minimal|precision|clean|white|light/.test(text))
            return registry.find((item) => item.id === "technical_banner_focus") || base;
        if (sectionKey === "products" && /large catalog|dense|sidebar|archive|many product|many categories/.test(text))
            return registry.find((item) => item.id === "category_sidebar_grid") || base;
        if (sectionKey === "applications" && /matrix|technical|spec|table/.test(text))
            return registry.find((item) => item.id === "industry_matrix") || base;
        if (sectionKey === "about_us" && /timeline|history|factory proof|milestone/.test(text))
            return registry.find((item) => item.id === "timeline_factory_proof") || base;
        if (sectionKey === "blog" && /resource|knowledge base|guide|index/.test(text))
            return registry.find((item) => item.id === "resource_center_index") || base;
        return base;
    }
    const aiSiteThemePalettes = [
        ["#143A7B", "#C8161C", "#F4F6FA", "#0E2A5C", "#0C1B33"],
        ["#0F766E", "#F97316", "#F0FDFA", "#064E3B", "#062D2A"],
        ["#4F46E5", "#E11D48", "#F5F3FF", "#312E81", "#17113D"],
        ["#1D4ED8", "#D97706", "#EFF6FF", "#1E3A8A", "#111827"],
        ["#334155", "#DC2626", "#F8FAFC", "#0F172A", "#020617"]
    ];
    function refreshAiSiteProjectThemePalette(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const current = sectionArray(schema.style_requirements.colors);
        const currentKey = current.slice(0, 5).join("|").toUpperCase();
        const currentIndex = aiSiteThemePalettes.findIndex((palette) => palette.join("|").toUpperCase() === currentKey);
        const validCustom = current
            .slice(0, 5)
            .filter((color) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))
            .map((color) => cleanHexColor(color, "#143A7B"));
        if (validCustom.length >= 2 && currentIndex < 0) {
            schema.style_requirements.colors = validCustom;
            project.schemaData = schema;
            project.tone = schema.style_requirements.preset || project.tone;
            return validCustom;
        }
        const nextPalette = aiSiteThemePalettes[currentIndex >= 0 ? (currentIndex + 1) % aiSiteThemePalettes.length : 1];
        schema.style_requirements.colors = nextPalette;
        project.schemaData = schema;
        project.tone = schema.style_requirements.preset || project.tone;
        return nextPalette;
    }
    function looksCorruptAiSiteText(value) {
        return /�|銆|鐨|鍖|浣|涓|绔|绯|logoutButton|login-screen|GoodJob CRM/i.test(value);
    }
    function brandWithHighlight(brand) {
        const clean = brand.trim() || "GoodJob";
        if (clean.length <= 3)
            return `<span>${htmlEscape(clean)}</span>`;
        return `${htmlEscape(clean.slice(0, -3))}<span>${htmlEscape(clean.slice(-3))}</span>`;
    }
    function aiSiteIconSprite() {
        return `<svg data-ai-site-sprite="xinhai-reference" xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="icon-location" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 7l10 7 10-7" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-linkedin" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" fill="currentColor"/><circle cx="4" cy="4" r="2" fill="currentColor"/></symbol><symbol id="icon-youtube" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" fill="currentColor"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor"/></symbol><symbol id="icon-facebook" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="currentColor"/></symbol><symbol id="icon-caret-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5"/></symbol><symbol id="icon-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol><symbol id="icon-arrow-left" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-arrow-next" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-cube" viewBox="0 0 24 24"><path d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 22V12M21 6.5L12 12 3 6.5" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-expertise" viewBox="0 0 24 24"><path d="M12 8V4M8 4h8M4 22V12a8 8 0 0116 0v10M4 22h16" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-building" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3"/></symbol><symbol id="icon-send" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol><symbol id="icon-to-top" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></symbol></svg>`;
    }
    function aiSiteFrameworkCss(project) {
        const design = project ? aiSiteDesignSystem(project) : null;
        const palette = design?.palette;
        const brand = palette?.brand || "#143A7B";
        const accent = palette?.accent || "#C8161C";
        const brandDeep = palette?.brandDeep || mixHexColor(brand, "#000000", 0.54);
        const brandWide = palette?.brandWide || mixHexColor(brand, "#FFFFFF", 0.14);
        const footer = palette?.dark || mixHexColor(brandDeep, "#000000", 0.28);
        const surface = palette?.surface || "#F4F6FA";
        return `:root{--blue:${brand};--blue-deep:${brandDeep};--blue-700:${brandWide};--red:${accent};--red-deep:${mixHexColor(accent, "#000000", 0.18)};--ink:#16202E;--body:#3C4858;--mid:#6B7686;--line:#E2E7EE;--bg:#FFFFFF;--bg-soft:${surface};--bg-steel:#EAEEF4;--footer:${footer};--footer-2:${mixHexColor(footer, "#000000", 0.16)};--gold:#E8A12C;--max:1280px;--r:4px;--ease:cubic-bezier(.4,0,.2,1);--shadow:0 10px 30px rgba(16,32,60,.10);--shadow-lg:0 24px 60px rgba(16,32,60,.16)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Barlow,Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--body);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}svg{display:block}.container,.ai-wrap{width:min(var(--max),calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.ai-topbar{background:var(--blue-deep);color:#AFC0DD;font-size:13.5px}.ai-topbar .container{min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:18px}.ai-topbar-left,.ai-topbar-right,.ai-socials,.ai-contact-line{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.ai-topbar svg{width:14px;height:14px;color:var(--red);flex:none}.ai-socials a{width:24px;height:24px;border:1px solid rgba(255,255,255,.18);border-radius:3px;display:grid;place-items:center;color:#C7D5EC}.ai-socials a:hover{background:var(--red);border-color:var(--red);color:#fff}.ai-socials svg{width:12px;height:12px}.ai-header{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 1px 0 rgba(16,32,60,.04)}.ai-nav{min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:clamp(14px,2vw,28px)}.ai-brand{font-weight:800;color:var(--blue);font-size:clamp(24px,2vw,34px);letter-spacing:-.02em;line-height:1;white-space:nowrap;flex:none}.ai-brand small{display:block;font-size:10px;color:var(--mid);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}.ai-brand span{color:var(--red)}.ai-nav-menu{display:flex;align-items:center;gap:4px;list-style:none;margin:0;padding:0;flex-wrap:nowrap;min-width:0}.ai-nav-menu li{flex:none}.ai-nav-link{display:flex;align-items:center;gap:6px;height:84px;padding:0 clamp(9px,1vw,17px);font-weight:700;font-size:clamp(13.5px,1vw,15px);color:var(--ink);position:relative;white-space:nowrap;flex:none}.ai-nav-link svg{width:12px;height:12px;flex:none}.ai-nav-link::after{content:"";position:absolute;left:17px;right:17px;bottom:24px;height:2px;background:var(--red);transform:scaleX(0);transform-origin:left;transition:transform .28s var(--ease)}.ai-nav-link:hover::after,.ai-nav-link.is-active::after{transform:scaleX(1)}.ai-caret{width:10px;height:10px}.ai-nav-item{position:relative}.ai-dropdown{position:absolute;top:100%;left:0;min-width:280px;background:#fff;border:1px solid var(--line);border-top:3px solid var(--red);box-shadow:var(--shadow);padding:10px;opacity:0;visibility:hidden;transform:translateY(10px);transition:all .26s var(--ease);border-radius:0 0 var(--r) var(--r)}.ai-nav-item:hover .ai-dropdown{opacity:1;visibility:visible;transform:none}.ai-dropdown a{display:flex;align-items:center;gap:10px;padding:11px 14px;font-size:14.5px;font-weight:600;color:var(--body);border-radius:3px;white-space:nowrap}.ai-dropdown a::before{content:"";width:6px;height:6px;background:var(--red);border-radius:50%;flex:none}.ai-header-cta{display:flex;align-items:center;gap:12px;flex:none}.ai-cta-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#F1F5FB;color:var(--blue);flex:none}.ai-cta-icon svg{width:20px;height:20px}.ai-header-cta > span:not(.ai-cta-icon){display:block;font-size:12px;color:var(--mid)}.ai-header-cta b{display:block;color:var(--ink);font-size:16px;white-space:nowrap}.ai-menu-button{display:none;width:46px;height:46px;border:1px solid var(--line);border-radius:4px;background:#fff;place-items:center}.ai-menu-button i,.ai-menu-button i::before,.ai-menu-button i::after{display:block;width:22px;height:2px;background:var(--ink);content:""}.ai-menu-button i::before{transform:translateY(-7px)}.ai-menu-button i::after{transform:translateY(5px)}.ai-hero{position:relative;min-height:clamp(560px,82vh,760px);padding:0;overflow:hidden;background:radial-gradient(circle at 72% 32%,rgba(127,176,255,.18),transparent 28%),linear-gradient(100deg,rgba(10,22,41,.96) 0%,rgba(10,22,41,.78) 48%,rgba(10,22,41,.48) 100%),linear-gradient(135deg,#20344f 0%,#6f7f83 48%,#1d3b65 100%);color:#fff}.ai-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:72px 72px;opacity:.35}.ai-hero-inner{position:relative;z-index:2;min-height:inherit;display:flex;align-items:center}.ai-hero-card{max-width:720px}.ai-hero-tag{display:inline-flex;align-items:center;gap:10px;background:rgba(200,22,28,.16);border:1px solid rgba(200,22,28,.5);color:#FFB2B6;font-weight:800;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px;border-radius:var(--r);margin-bottom:22px}.ai-hero-tag::before{content:"";width:8px;height:8px;background:var(--red);border-radius:50%;box-shadow:0 0 0 4px rgba(200,22,28,.3)}.ai-hero h1{font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif;font-size:clamp(40px,5.4vw,72px);line-height:.98;color:#fff;letter-spacing:.01em;margin:0 0 20px}.ai-hero p{font-size:clamp(16px,1.7vw,20px);line-height:1.7;color:#C8D6EE;max-width:620px;margin:0 0 34px}.ai-actions,.btn-row{display:flex;gap:16px;flex-wrap:wrap}.ai-btn,.primary-btn,.ghost-btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 28px;border-radius:var(--r);font-weight:800;text-transform:uppercase;letter-spacing:.03em}.ai-btn svg,.primary-btn svg,.ghost-btn svg{width:18px;height:18px}.ai-btn-primary,.primary-btn{background:var(--red);color:#fff;border:1px solid var(--red)}.ai-btn-ghost,.ghost-btn{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.46)}.ai-hero-nav{position:absolute;z-index:3;left:0;right:0;bottom:38px}.ai-hero-nav .container{display:flex;justify-content:space-between;align-items:center}.ai-hero-dots{display:flex;gap:10px}.ai-dot{width:38px;height:4px;background:rgba(255,255,255,.3);border-radius:2px}.ai-dot.is-active{background:var(--red);width:54px}.ai-hero-arrows{display:flex;gap:10px}.ai-arrow{width:50px;height:50px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.05);color:#fff;border-radius:var(--r);display:grid;place-items:center}.ai-arrow svg{width:20px;height:20px}.ai-photo-hero .hero-bg span{transition:opacity .9s ease}.ai-photo-hero .hero-bg span.is-active,.ai-photo-hero[data-active-slide="1"] .hero-bg-1,.ai-photo-hero[data-active-slide="2"] .hero-bg-2,.ai-photo-hero[data-active-slide="3"] .hero-bg-3{opacity:1!important;animation:none!important}.ai-photo-hero .ai-hero-status span.is-active{display:inline!important;opacity:1!important;animation:none!important}.ai-hero-strip{background:var(--blue);color:#fff}.ai-hero-strip .ai-strip-grid{display:grid;grid-template-columns:repeat(4,1fr)}.ai-stat{display:flex;align-items:center;gap:18px;min-height:100px;padding:22px 34px;border-left:1px solid rgba(255,255,255,.16)}.ai-stat:last-child{border-right:1px solid rgba(255,255,255,.16)}.ai-stat svg{width:32px;height:32px;color:#B9D2FF}.ai-stat strong{display:block;font-size:clamp(24px,2.2vw,32px);line-height:1;font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif}.ai-stat span{display:block;color:#D7E4FF;font-size:14px;margin-top:3px}.ai-section,section.ai-section{padding:96px 0;border:0;overflow:hidden}.ai-section-soft{background:var(--bg-soft)}.ai-section-steel{background:var(--bg-steel)}.ai-section-dark{background:var(--footer);color:#C7D2E4}.ai-section-head{max-width:760px;margin:0 0 52px}.ai-section-head.center{margin-left:auto;margin-right:auto;text-align:center}.eyebrow,.ai-eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--red);font-weight:900;font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}.eyebrow::before,.ai-eyebrow::before{content:"";width:28px;height:2px;background:var(--red)}.ai-section h2,.ai-section-title{font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif;font-size:clamp(30px,3.6vw,46px);line-height:1.06;color:var(--ink);margin:0}.ai-section-dark h2{color:#fff}.ai-section-sub{margin-top:18px;font-size:17px;color:var(--mid);line-height:1.75}.ai-grid,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:clamp(18px,3vw,32px)}.ai-card,.card{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:0 1px 0 rgba(16,32,60,.04);padding:clamp(22px,2.4vw,32px);min-width:0}.ai-card h3,.card h3{margin:0 0 10px;color:var(--ink);font-size:clamp(20px,1.6vw,24px)}.ai-card p,.card p{color:var(--body);line-height:1.72}.ai-footer,.footer{background:var(--footer);color:#C7D2E4}.ai-footer-top,.footer-top{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.15fr;gap:clamp(26px,4vw,56px);padding:72px 0}.ai-footer h3,.ai-footer h4,.footer h3,.footer h4{color:#fff;margin-top:0}.ai-footer ul,.footer ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ai-footer li,.footer li{display:flex;align-items:center;gap:9px;min-width:0}.ai-footer li svg,.footer li svg{width:16px;height:16px;flex:none;color:var(--red)}.ai-footer li,.ai-footer p,.footer li,.footer p{color:#C7D2E4;line-height:1.7}.ai-footer-brand{font-size:28px;font-weight:900;color:#fff}.ai-footer-brand span{color:var(--red)}.ai-footer-bottom,.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98A6BD}.to-top{float:right;color:#fff;display:inline-flex;align-items:center;gap:8px}.to-top svg{width:14px;height:14px;display:inline-block}.placeholder{background:var(--bg-soft)}.placeholder .ai-card,.placeholder .card{border-style:dashed}@media(max-width:1180px){.ai-nav-menu,.ai-header-cta,.ai-topbar-left .hide-md{display:none}.ai-menu-button{display:grid}.ai-nav{min-height:84px;position:relative}.ai-header.is-menu-open .ai-nav-menu{position:absolute;left:0;right:0;top:100%;display:flex;flex-direction:column;align-items:stretch;gap:0;background:#fff;border:1px solid var(--line);box-shadow:var(--shadow-lg);padding:8px 10px 12px;z-index:60}.ai-header.is-menu-open .ai-nav-menu li{width:100%}.ai-header.is-menu-open .ai-nav-link{height:auto;min-height:44px;padding:10px 8px;color:var(--ink)}.ai-header.is-menu-open .ai-nav-link::after{display:none}.ai-header.is-menu-open .ai-nav-item .ai-dropdown{position:static;min-width:0;opacity:1;visibility:visible;transform:none;box-shadow:none;border:1px solid var(--line);border-top:2px solid var(--red);margin:2px 0 8px}.ai-hero-strip .ai-strip-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.container,.ai-wrap{width:min(100% - 40px,680px)}.ai-topbar .container{justify-content:space-between}.ai-topbar-left{gap:12px}.ai-topbar-left .ai-contact-line:nth-child(n+2){display:none}.ai-hero{min-height:760px}.ai-hero-card{max-width:100%}.ai-hero h1{font-size:clamp(38px,12vw,54px)}.ai-actions .ai-btn,.btn-row .primary-btn,.btn-row .ghost-btn{width:100%}.ai-hero-nav{bottom:38px}.ai-stat{min-height:122px;padding:24px 20px}.ai-section,section.ai-section{padding:64px 0}.ai-footer-top,.footer-top{grid-template-columns:1fr}.ai-footer-bottom,.footer-bottom{text-align:center}.to-top{float:none;display:inline-flex;margin-top:10px}}`;
    }
    function aiSiteStats(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const productCount = Math.max(3, sectionArray(schema.business_taxonomy.product_categories).length);
        return [
            { icon: "icon-cube", value: "272+", label: "Projects Delivered" },
            { icon: "icon-globe", value: "12+", label: "Countries Served" },
            { icon: "icon-expertise", value: `${productCount}+`, label: "Core Product Lines" },
            { icon: "icon-building", value: "EPCM+O", label: "One-Stop Delivery" }
        ];
    }
    function svgUse(icon) {
        return `<svg aria-hidden="true"><use href="#${icon}"></use></svg>`;
    }
    function aiSiteChromeThemeCss(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const design = aiSiteDesignSystem(project);
        const preset = `${schema.style_requirements.preset || project.tone || ""} ${sectionArray(schema.style_requirements.keywords).join(" ")}`.toLowerCase();
        const customColors = sectionArray(schema.style_requirements.colors).length > 0;
        const brand = design.palette.brand;
        const accent = design.palette.accent;
        const deep = design.palette.brandDeep;
        const footer = design.palette.dark;
        const soft = design.palette.surface;
        const lightHeader = /clean|minimal|white|light/.test(preset);
        const darkHeader = !lightHeader && (customColors || /dark|black|luxury|tech|futur|cyber|bold/.test(preset));
        const headerBg = darkHeader ? `linear-gradient(90deg,${deep},${brand})` : "#ffffff";
        const headerText = darkHeader ? readableTextOn(deep) : design.palette.ink;
        const mutedText = darkHeader ? "rgba(255,255,255,.72)" : design.palette.muted;
        const dropdownBg = darkHeader ? "#ffffff" : "#ffffff";
        const ctaBg = darkHeader ? "rgba(255,255,255,.12)" : soft;
        return `<style data-ai-site-chrome-theme="color-only">
.ai-topbar{background:${deep};color:rgba(255,255,255,.74)}
.ai-topbar svg,.ai-footer li svg{color:${accent}}
.ai-socials a:hover{background:${accent};border-color:${accent};color:#fff}
.ai-header{background:${headerBg};border-bottom-color:${darkHeader ? "rgba(255,255,255,.12)" : design.palette.line}}
.ai-brand,.ai-nav-link,.ai-header-cta b{color:${headerText}}
.ai-brand span,.ai-eyebrow,.eyebrow{color:${accent}}
.ai-brand small,.ai-header-cta > span:not(.ai-cta-icon){color:${mutedText}}
.ai-nav-link::after,.ai-dropdown{border-top-color:${accent}}
.ai-dropdown{background:${dropdownBg}}
.ai-dropdown a::before{background:${accent}}
.ai-cta-icon{background:${ctaBg};color:${darkHeader ? "#ffffff" : brand}}
.ai-footer,.footer{background:${footer};color:rgba(255,255,255,.76)}
.ai-footer-brand span{color:${accent}}
.ai-footer-bottom,.footer-bottom{border-top-color:rgba(255,255,255,.12)}
#home.ai-photo-hero .hero-bg span::after{background:linear-gradient(90deg,${mixHexColor(deep, "#000000", 0.28)}E8,${mixHexColor(deep, "#000000", 0.12)}B8 48%,${brand}52),linear-gradient(180deg,transparent,${mixHexColor(deep, "#000000", 0.22)}A8)!important}
#home.ai-photo-hero .ai-hero-tag{background:${mixHexColor(accent, "#000000", 0.1)}42!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-hero-tag::before{background:${accent}!important;box-shadow:0 0 0 4px ${accent}55!important}
#home.ai-photo-hero .ai-btn-primary{background:${accent}!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-btn-ghost,#home.ai-photo-hero .ai-arrow{border-color:${mixHexColor(brand, "#FFFFFF", 0.42)}!important}
#home.ai-photo-hero .ai-arrow:hover{background:${accent}!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-hero-status span{color:${mixHexColor(brand, "#FFFFFF", 0.7)}!important}
</style>`;
    }
    function aiSiteWpThemeScript() {
        return `(() => {
  const onReady = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };
  const qsa = (root, selector) => Array.from(root.querySelectorAll(selector));

  function initMobileHeader() {
    qsa(document, ".ai-header").forEach((header) => {
      const button = header.querySelector(".ai-menu-button");
      const menu = header.querySelector(".ai-nav-menu");
      if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
      button.setAttribute("aria-expanded", "false");
      const close = () => {
        header.classList.remove("is-menu-open");
        button.setAttribute("aria-expanded", "false");
      };
      const toggle = () => {
        const open = !header.classList.contains("is-menu-open");
        header.classList.toggle("is-menu-open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
      qsa(menu, "a").forEach((link) => link.addEventListener("click", close));
      document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    });
  }

  function initHeroSliders() {
    qsa(document, ".ai-photo-hero").forEach((hero) => {
      if (!(hero instanceof HTMLElement)) return;
      const slides = qsa(hero, ".hero-bg span");
      if (!slides.length) return;
      const radios = qsa(hero, "input.hero-radio").filter((item) => item instanceof HTMLInputElement);
      const status = qsa(hero, ".ai-hero-status span");
      let index = Math.max(0, radios.findIndex((item) => item.checked));
      if (index < 0 || index >= slides.length) index = 0;
      let timer = 0;
      const setSlide = (next, manual = false) => {
        index = (next + slides.length) % slides.length;
        hero.dataset.activeSlide = String(index + 1);
        slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
        const radio = radios[index];
        if (radio instanceof HTMLInputElement) radio.checked = true;
        status.forEach((item) => {
          if (!(item instanceof HTMLElement)) return;
          const text = item.textContent || "";
          const matches = new RegExp(String(index + 1).padStart(2, "0") + "\\\\s*/").test(text) || item.classList.contains("s" + (index + 1));
          item.classList.toggle("is-active", matches);
        });
        if (manual) restart();
      };
      const restart = () => {
        if (timer) window.clearInterval(timer);
        timer = window.setInterval(() => setSlide(index + 1), 6000);
      };
      qsa(hero, ".ai-arrow[for]").forEach((control) => {
        control.addEventListener("click", () => {
          const target = String(control.getAttribute("for") || "");
          const matched = target.match(/(\\d+)$/);
          if (matched) setSlide(Number(matched[1]) - 1, true);
        });
      });
      radios.forEach((radio, radioIndex) => radio.addEventListener("change", () => setSlide(radioIndex, true)));
      setSlide(index);
      restart();
    });
  }

  function initProductsTabs() {
    qsa(document, ".products-category-showcase").forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const buttons = qsa(section, ".products-tab, [data-product-category]").filter((item) => item instanceof HTMLElement);
      if (!buttons.length) return;
      const panels = qsa(section, "[data-product-category-panel]").filter((item) => item instanceof HTMLElement);
      const cards = qsa(section, ".products-card").filter((item) => item instanceof HTMLElement);
      const updateFallbackCards = (label) => {
        cards.forEach((card, cardIndex) => {
          const title = card.querySelector("h3");
          const image = card.querySelector("img");
          const names = [
            "Standard Model",
            "Export Series",
            "Heavy Duty Assembly",
            "Custom Unit",
            "Compact Type",
            "High Flow Version",
            "Corrosion Resistant Series",
            "Project Spare Kit"
          ];
          const nextName = (label + " " + names[cardIndex % names.length]).trim();
          if (title) title.textContent = nextName.toUpperCase();
          if (image instanceof HTMLImageElement && /placehold\\.co/i.test(image.src)) {
            image.src = "https://placehold.co/560x420/f8fafc/244aa5?text=" + encodeURIComponent(nextName).replace(/%20/g, "+");
            image.alt = nextName;
          }
        });
      };
      const activate = (button) => {
        const label = String(button.getAttribute("data-product-category") || button.textContent || "").trim();
        if (!label) return;
        buttons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        let panelFound = false;
        panels.forEach((panel) => {
          const active = String(panel.getAttribute("data-product-category-panel") || "").toLowerCase() === label.toLowerCase();
          panel.hidden = !active;
          panel.classList.toggle("is-active", active);
          panelFound = panelFound || active;
        });
        if (!panelFound) updateFallbackCards(label);
        const firstPage = section.querySelector("#products-page-1");
        if (firstPage instanceof HTMLInputElement) firstPage.checked = true;
      };
      buttons.forEach((button, buttonIndex) => {
        if (!button.hasAttribute("data-product-category")) button.setAttribute("data-product-category", String(button.textContent || "").trim());
        button.setAttribute("role", "tab");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          activate(button);
        });
        if (button.classList.contains("is-active") || buttonIndex === 0) button.setAttribute("aria-selected", button.classList.contains("is-active") ? "true" : "false");
      });
      const initial = buttons.find((button) => button.classList.contains("is-active")) || buttons[0];
      activate(initial);
    });
  }

  onReady(() => {
    initMobileHeader();
    initHeroSliders();
    initProductsTabs();
  });
})();`;
    }
    function defaultAiSectionHtml(sectionKey, project, generated = false, customPages = []) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const company = schema.company_profile;
        const contact = schema.contact_info;
        const taxonomy = schema.business_taxonomy;
        const blueprint = cleanAiSiteBlueprint(project);
        const brand = company.wordmark || company.legal_name || project.siteName || "GoodJob";
        const categories = sectionArray(taxonomy.product_categories);
        const solutions = sectionArray(taxonomy.solutions);
        const generatedBadge = generated ? "Generated" : "Blueprint";
        const sectionLabel = aiSiteSectionLabel(sectionKey, customPages);
        const text = blueprint[sectionKey] || sectionLabel;
        const frameworkCss = aiSiteFrameworkCss(project);
        const chromeThemeCss = aiSiteChromeThemeCss(project);
        const contactEmail = contact.email || "sales@example.com";
        const contactPhone = contact.phone || "+86-0000-0000";
        const contactAddress = contact.address || "Shandong, China";
        if (sectionKey === "header") {
            const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<a href="#products">${htmlEscape(item)}</a>`).join("");
            return `<!doctype html><html><head><meta charset="utf-8"><style>${frameworkCss}</style></head><body>${aiSiteIconSprite()}${chromeThemeCss}<div class="ai-topbar"><div class="container"><div class="ai-topbar-left"><span class="ai-contact-line">${svgUse("icon-location")}${htmlEscape(contactAddress)}</span><a class="ai-contact-line hide-md" href="tel:${htmlEscape(contactPhone)}">${svgUse("icon-phone")}24/7 Engineering Support</a><a class="ai-contact-line hide-md" href="mailto:${htmlEscape(contactEmail)}">${svgUse("icon-mail")}${htmlEscape(contactEmail)}</a></div><div class="ai-topbar-right"><span>EN</span><div class="ai-socials"><a href="#" aria-label="LinkedIn">${svgUse("icon-linkedin")}</a><a href="#" aria-label="YouTube">${svgUse("icon-youtube")}</a><a href="#" aria-label="Facebook">${svgUse("icon-facebook")}</a></div></div></div></div><header class="ai-header"><div class="container ai-nav"><a class="ai-brand" href="#home">${brandWithHighlight(brand)}<small>Industrial Website</small></a><ul class="ai-nav-menu"><li><a class="ai-nav-link is-active" href="#home">Home</a></li><li class="ai-nav-item"><a class="ai-nav-link" href="#products">Products ${svgUse("icon-caret-down")}</a><div class="ai-dropdown">${productItems}</div></li><li><a class="ai-nav-link" href="#applications">Applications</a></li><li><a class="ai-nav-link" href="#about-us">About Us</a></li><li><a class="ai-nav-link" href="#blog">Blog</a></li><li><a class="ai-nav-link" href="#contact-us">Contact Us</a></li></ul><a class="ai-header-cta" href="#contact-us"><span class="ai-cta-icon">${svgUse("icon-phone")}</span><span>Get a Free Consultation<b>Contact Us</b></span></a><button class="ai-menu-button" type="button" aria-label="Menu"><i></i></button></div></header>`;
        }
        if (sectionKey === "footer") {
            const serviceItems = ["Application Matching", "Export Documentation", "Distributor Support"].map((item) => `<li>${htmlEscape(item)}</li>`).join("");
            const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
            return `${chromeThemeCss}<footer class="ai-footer"><div class="container ai-footer-top"><div><h3 class="ai-footer-brand">${brandWithHighlight(brand)}</h3><p>${htmlEscape(company.tagline || "Turnkey industrial website delivery for global B2B buyers.")}</p><p>${htmlEscape(company.description || "We help overseas buyers understand products, applications, service capability, and inquiry paths with a consistent industrial website framework.")}</p><div class="ai-socials"><a href="#" aria-label="LinkedIn">${svgUse("icon-linkedin")}</a><a href="#" aria-label="YouTube">${svgUse("icon-youtube")}</a><a href="#" aria-label="Facebook">${svgUse("icon-facebook")}</a></div></div><div><h4>Capabilities</h4><ul>${serviceItems}</ul></div><div><h4>Products</h4><ul>${productItems}</ul></div><div><h4>Contact</h4><ul><li>${svgUse("icon-location")}${htmlEscape(contactAddress)}</li><li>${svgUse("icon-mail")}${htmlEscape(contactEmail)}</li><li>${svgUse("icon-phone")}${htmlEscape(contactPhone)}</li></ul></div></div><div class="container ai-footer-bottom">&copy; ${new Date().getFullYear()} ${htmlEscape(brand)}. All rights reserved. <a href="#home" id="toTop" class="to-top">Back to top ${svgUse("icon-to-top")}</a></div></footer>`;
        }
        if (sectionKey === "hero") {
            const category = categories[0] || "Industrial Systems";
            const title = company.tagline || `${brand} ${category} Solutions for Global Buyers`;
            const eyebrow = brand.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().slice(0, 28) || "B2B INDUSTRIAL";
            return `${chromeThemeCss}<section class="ai-hero ai-photo-hero ${generated ? "" : "placeholder"}" id="home" data-hero-image-api="/api/ai-site-builder/projects/{projectId}/hero-backgrounds"><style>#home.ai-photo-hero{position:relative;min-height:72vh;color:#fff;background:#091526;overflow:hidden}#home .hero-radio{position:absolute;opacity:0;pointer-events:none}#home .hero-bg{position:absolute;inset:0;z-index:0;background:#091526}#home .hero-bg span{position:absolute;inset:0;background-position:center;background-size:cover;opacity:0;animation:heroAutoFade 18s infinite}#home .hero-bg span::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,17,32,.92),rgba(7,17,32,.66) 48%,rgba(7,17,32,.32)),linear-gradient(180deg,rgba(7,17,32,.12),rgba(7,17,32,.42))}#home .hero-bg-1{background-image:url("https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1800&q=80");animation-delay:0s}#home .hero-bg-2{background-image:url("https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1800&q=80");animation-delay:6s}#home .hero-bg-3{background-image:url("https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1800&q=80");animation-delay:12s}#home #hero-slide-1:checked~.hero-bg span,#home #hero-slide-2:checked~.hero-bg span,#home #hero-slide-3:checked~.hero-bg span{animation:none;opacity:0}#home #hero-slide-1:checked~.hero-bg .hero-bg-1,#home #hero-slide-2:checked~.hero-bg .hero-bg-2,#home #hero-slide-3:checked~.hero-bg .hero-bg-3{opacity:1}#home .ai-hero-inner{position:relative;z-index:2;min-height:72vh}#home .ai-hero-card{max-width:min(760px,72vw)}#home .ai-hero-tag{background:rgba(200,22,28,.22);border-color:rgba(200,22,28,.72);color:#ffd7d9}#home h1{max-width:820px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}#home .ai-hero-nav{left:auto;right:clamp(24px,6vw,92px);bottom:clamp(22px,4vw,48px);width:auto;z-index:4}#home .ai-hero-nav .container{width:auto;display:flex;align-items:center;gap:14px}#home .ai-hero-status span{display:none;color:#fff;font-weight:900;letter-spacing:.16em}#home .ai-hero-status .auto{display:inline-block;opacity:0;animation:heroStatusFade 18s infinite}#home .ai-hero-status .auto-2{animation-delay:6s}#home .ai-hero-status .auto-3{animation-delay:12s}#home #hero-slide-1:checked~.ai-hero-nav .s1,#home #hero-slide-2:checked~.ai-hero-nav .s2,#home #hero-slide-3:checked~.ai-hero-nav .s3{display:inline}#home #hero-slide-1:checked~.ai-hero-nav .auto,#home #hero-slide-2:checked~.ai-hero-nav .auto,#home #hero-slide-3:checked~.ai-hero-nav .auto{display:none}#home .ai-hero-arrows{display:grid;grid-template-columns:52px 52px;gap:10px}#home .ai-arrow{display:none;width:52px;height:52px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);color:#fff;place-items:center;cursor:pointer;backdrop-filter:blur(6px)}#home .hero-prev-auto,#home .hero-next-auto{display:grid}#home #hero-slide-1:checked~.ai-hero-nav .ai-arrow,#home #hero-slide-2:checked~.ai-hero-nav .ai-arrow,#home #hero-slide-3:checked~.ai-hero-nav .ai-arrow{display:none}#home #hero-slide-1:checked~.ai-hero-nav .hero-prev-1,#home #hero-slide-1:checked~.ai-hero-nav .hero-next-1,#home #hero-slide-2:checked~.ai-hero-nav .hero-prev-2,#home #hero-slide-2:checked~.ai-hero-nav .hero-next-2,#home #hero-slide-3:checked~.ai-hero-nav .hero-prev-3,#home #hero-slide-3:checked~.ai-hero-nav .hero-next-3{display:grid}@keyframes heroAutoFade{0%,30%{opacity:1}33%,100%{opacity:0}}@keyframes heroStatusFade{0%,30%{opacity:1}33%,100%{opacity:0}}@media(max-width:760px){#home.ai-photo-hero,#home .ai-hero-inner{min-height:72vh}#home .ai-hero-card{max-width:100%}#home .ai-hero-nav{right:20px;bottom:18px}#home .ai-hero-arrows{grid-template-columns:44px 44px}#home .ai-arrow{width:44px;height:44px}}</style><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-1"><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-2"><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-3"><div class="hero-bg"><span class="hero-bg-1" data-upload-slot="hero-background-1"></span><span class="hero-bg-2" data-upload-slot="hero-background-2"></span><span class="hero-bg-3" data-upload-slot="hero-background-3"></span></div><div class="container ai-hero-inner"><div class="ai-hero-card"><span class="ai-hero-tag">${htmlEscape(eyebrow)}</span><h1>${htmlEscape(title)}</h1><p>${htmlEscape(company.description || text)}</p><div class="ai-actions"><a class="ai-btn ai-btn-primary" href="#contact-us">Request a Proposal ${svgUse("icon-arrow-right")}</a><a class="ai-btn ai-btn-ghost" href="#products">Learn More</a></div></div></div><div class="ai-hero-nav"><div class="container"><div class="ai-hero-status"><span class="auto auto-1">01 / 03</span><span class="auto auto-2">02 / 03</span><span class="auto auto-3">03 / 03</span><span class="s1">01 / 03</span><span class="s2">02 / 03</span><span class="s3">03 / 03</span></div><div class="ai-hero-arrows"><label class="ai-arrow hero-prev-auto" for="hero-slide-3">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-auto" for="hero-slide-2">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-1" for="hero-slide-3">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-1" for="hero-slide-2">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-2" for="hero-slide-1">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-2" for="hero-slide-3">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-3" for="hero-slide-2">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-3" for="hero-slide-1">${svgUse("icon-arrow-next")}</label></div></div></div></section>`;
        }
        if (sectionKey === "products") {
            const productCategories = (categories.length ? categories : ["Gate Valve", "Butterfly Valve", "Check Valve & Strainer", "Ball Valve", "Globe Valve", "Control Valve", "Other Valve And Fittings"]).slice(0, 8);
            const activeCategory = productCategories[Math.min(3, productCategories.length - 1)] || productCategories[0] || "Industrial Product";
            const categoryButtons = productCategories.map((item) => `<button type="button" class="products-tab${item === activeCategory ? " is-active" : ""}" data-product-category="${htmlEscape(item)}">${htmlEscape(item)}</button>`).join("");
            const productBase = activeCategory.replace(/\s*&\s*/g, " ").replace(/\s+/g, " ").trim() || "Industrial Product";
            const products = [
                `1PC ${productBase} Standard Model`,
                `2PC ${productBase} Export Series`,
                `${productBase} Heavy Duty Assembly`,
                `Stainless Steel ${productBase} Custom Unit`,
                `${productBase} OEM Compact Type`,
                `${productBase} High Flow Version`,
                `${productBase} Corrosion Resistant Series`,
                `${productBase} Project Spare Kit`
            ];
            const cardMarkup = (items) => items.map((name) => `<article class="products-card"><div class="products-image"><img src="https://placehold.co/560x420/f8fafc/244aa5?text=${encodeURIComponent(name).replace(/%20/g, "+")}" alt="${htmlEscape(name)}"></div><h3>${htmlEscape(name)}</h3><a href="#contact-us" aria-label="Request ${htmlEscape(name)}">${svgUse("icon-arrow-right")}</a></article>`).join("");
            return `<section class="ai-section products-category-showcase ${generated ? "" : "placeholder"}" id="products"><style>#products{background:#fff;padding:clamp(54px,6vw,92px) 0;overflow:hidden}#products .products-wrap{width:min(1560px,calc(100vw - clamp(34px,6vw,120px)));margin:auto}#products .products-head{text-align:center;max-width:980px;margin:0 auto clamp(28px,4vw,52px)}#products .products-head h2{font-size:clamp(36px,4.2vw,58px);line-height:1.04;margin:0 0 14px;color:#050b18}#products .products-head p{margin:0;color:#586171;font-size:clamp(15px,1.15vw,18px);line-height:1.7}#products .products-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(10px,1.4vw,18px);margin-bottom:clamp(34px,4.4vw,58px)}#products .products-tab{min-width:min(184px,100%);border:1px solid #a7acb8;border-radius:999px;background:#fff;color:#868b95;padding:12px 22px;font-weight:800;cursor:pointer}#products .products-tab.is-active{border-color:#244aa5;background:#244aa5;color:#fff}#products .products-radio{position:absolute;opacity:0;pointer-events:none}#products .products-stage{position:relative}#products .products-track{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(22px,2.8vw,38px);padding:0 clamp(34px,5vw,70px)}#products #products-page-1:checked~.products-stage .page-1,#products #products-page-2:checked~.products-stage .page-2{display:grid}#products .products-card{position:relative;background:#f5f5f6;min-width:0;padding:14px 14px 0;text-align:center;overflow:hidden}#products .products-image{background:#fff;aspect-ratio:1/1;display:grid;place-items:center;margin-bottom:22px}#products .products-image img{width:100%;height:100%;object-fit:contain;display:block}#products .products-card h3{min-height:64px;margin:0;padding:0 6px 26px;color:#111827;font-size:clamp(15px,1.1vw,18px);line-height:1.45;text-transform:uppercase;letter-spacing:.02em}#products .products-card a{position:absolute;right:0;bottom:0;width:52px;height:52px;display:grid;place-items:end;background:linear-gradient(135deg,transparent 0 49%,#244aa5 50%);color:#fff;padding:0 7px 7px 0}#products .products-card svg{width:18px;height:18px}#products .products-arrow{position:absolute;top:50%;transform:translateY(-50%);width:54px;height:74px;color:#244aa5;display:grid;place-items:center;cursor:pointer}#products .products-arrow svg{width:46px;height:46px;stroke-width:3}#products .products-arrow.prev{left:0}#products .products-arrow.next{right:0}#products .prev-1,#products .next-1,#products .prev-2,#products .next-2{display:none}#products #products-page-1:checked~.products-stage .prev-1,#products #products-page-1:checked~.products-stage .next-1,#products #products-page-2:checked~.products-stage .prev-2,#products #products-page-2:checked~.products-stage .next-2{display:grid}@media(max-width:1080px){#products .products-track{grid-template-columns:repeat(2,minmax(0,1fr));padding:0 58px}#products .products-tab{min-width:150px}}@media(max-width:760px){#products{padding:44px 0}#products .products-wrap{width:min(100% - 32px,680px)}#products .products-track{grid-template-columns:1fr;padding:0}#products .products-arrow{display:none}#products .products-tab{min-width:0;flex:1 1 150px}}</style><div class="products-wrap"><div class="products-head"><h2>Product Category</h2><p>${htmlEscape(text || `We provide ${productCategories.slice(0, 4).join(", ")} and related industrial products manufactured for global B2B purchasing standards.`)}</p></div><div class="products-tabs">${categoryButtons}</div><input class="products-radio" type="radio" name="products-page" id="products-page-1" checked><input class="products-radio" type="radio" name="products-page" id="products-page-2"><div class="products-stage"><label class="products-arrow prev prev-1" for="products-page-2" aria-label="Previous products">${svgUse("icon-arrow-left")}</label><label class="products-arrow next next-1" for="products-page-2" aria-label="Next products">${svgUse("icon-arrow-next")}</label><label class="products-arrow prev prev-2" for="products-page-1" aria-label="Previous products">${svgUse("icon-arrow-left")}</label><label class="products-arrow next next-2" for="products-page-1" aria-label="Next products">${svgUse("icon-arrow-next")}</label><div class="products-track page-1">${cardMarkup(products.slice(0, 4))}</div><div class="products-track page-2">${cardMarkup(products.slice(4, 8))}</div></div></div></section>`;
        }
        if (sectionKey === "applications") {
            const applicationItems = [
                ["Search Visibility", "Buyers search by application and specification, but thin pages miss long-tail demand.", categories[0] || "Core Products", "Capture higher-intent organic visits."],
                ["Inquiry Conversion", "Visitors need clearer trust signals, RFQ prompts, and product-fit guidance before they contact sales.", categories[1] || categories[0] || "Configured Solutions", "Turn more visits into qualified requests."],
                ["Product Selection", "Complex catalogs make it hard for overseas buyers to choose the right technical route quickly.", categories[2] || categories[0] || "Custom Options", "Shorten the path from browsing to inquiry."],
                ["Distributor Support", "Regional partners need consistent product proof, documentation, and response paths.", categories[3] || categories[0] || "Export Support", "Support faster partner evaluation."]
            ];
            const cards = applicationItems.map(([title, pain, product, outcome], index) => `<article class="applications-card"><span class="applications-index">${String(index + 1).padStart(2, "0")}</span><h3>${htmlEscape(title)}</h3><p>${htmlEscape(pain)}</p><div class="applications-chip">${htmlEscape(product)}</div><strong>${htmlEscape(outcome)}</strong></article>`).join("");
            return `<section class="ai-section applications-horizontal-card-preview ${generated ? "" : "placeholder"}" id="applications"><style>#applications{position:relative;background:linear-gradient(135deg,#f7fbff,#ffffff);padding:clamp(56px,7vw,96px) 0;color:#0b1f35;overflow:hidden}#applications .applications-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto}#applications .applications-head{display:grid;grid-template-columns:minmax(0,.85fr) minmax(260px,.45fr);gap:clamp(18px,4vw,58px);align-items:end;margin-bottom:clamp(26px,4vw,44px)}#applications .applications-eyebrow{display:inline-flex;width:max-content;margin-bottom:12px;color:#f97316;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}#applications h2{margin:0;color:#0b1f35;font-size:clamp(34px,4.2vw,58px);line-height:1.05;letter-spacing:0}#applications .applications-head p{margin:0;color:#536273;font-size:clamp(15px,1.2vw,18px);line-height:1.72}#applications .applications-row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(280px,360px);gap:clamp(16px,2.3vw,28px);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:4px 4px 18px}#applications .applications-row::-webkit-scrollbar{height:9px}#applications .applications-row::-webkit-scrollbar-thumb{background:#cbd5e1}#applications .applications-card{scroll-snap-align:start;min-width:0;background:#fff;border:1px solid #dce5ef;box-shadow:0 18px 50px rgba(11,31,53,.08);padding:clamp(22px,2.6vw,30px);display:grid;gap:14px;align-content:start}#applications .applications-index{display:grid;place-items:center;width:42px;height:42px;background:#0f4c81;color:#fff;font-weight:900}#applications .applications-card h3{margin:0;color:#0b1f35;font-size:clamp(20px,1.9vw,26px);line-height:1.18}#applications .applications-card p{margin:0;color:#536273;line-height:1.66;font-size:15px}#applications .applications-chip{width:max-content;max-width:100%;padding:8px 11px;background:#eef6ff;color:#0f4c81;border:1px solid #cfe3f7;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.06em;overflow-wrap:anywhere}#applications .applications-card strong{display:block;margin-top:2px;color:#0b1f35;line-height:1.45}#applications .applications-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:clamp(22px,3vw,34px)}#applications .applications-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 18px;background:#f97316;color:#fff;text-decoration:none;font-weight:900}#applications .applications-btn svg{width:18px;height:18px}#applications .applications-note{color:#536273;font-weight:700}@media(max-width:900px){#applications .applications-head{grid-template-columns:1fr;align-items:start}#applications .applications-row{grid-auto-columns:minmax(260px,82vw)}}@media(max-width:640px){#applications{padding:46px 0}#applications .applications-wrap{width:min(100% - 32px,680px)}#applications h2{font-size:34px}#applications .applications-row{gap:14px;padding-bottom:14px}#applications .applications-actions a{width:100%}}</style><div class="applications-wrap"><div class="applications-head"><div><span class="applications-eyebrow">Applications</span><h2>Application Paths Built Around Buyer Intent</h2></div><p>${htmlEscape(text || "Map each scenario to the product proof, content structure, and inquiry path that helps overseas buyers move from research to RFQ.")}</p></div><div class="applications-row">${cards}</div><div class="applications-actions"><a class="applications-btn" href="#contact-us">Discuss Your Application ${svgUse("icon-arrow-right")}</a><span class="applications-note">Horizontal preview cards stay readable across desktop and mobile.</span></div></div></section>`;
        }
        if (sectionKey === "contact_us") {
            const contactMethods = [
                ["icon-phone", "Phone", contactPhone],
                ["icon-mail", "Email", contactEmail],
                ["icon-location", "Location", contactAddress]
            ].map(([icon, label, value]) => `<li>${svgUse(icon)}<span>${htmlEscape(label)}</span><b>${htmlEscape(value)}</b></li>`).join("");
            const proofItems = [
                "Response within 24 hours",
                "Free technical review before quotation",
                "Export-ready documentation and delivery support",
                "Project details routed to the engineering team"
            ].map((item) => `<li>${svgUse("icon-check")}<span>${htmlEscape(item)}</span></li>`).join("");
            return `<section class="ai-section contact-inquiry-section ${generated ? "" : "placeholder"}" id="contact-us"><style>#contact-us{background:linear-gradient(135deg,#0b1f35 0%,#102f4f 48%,#f4f8fb 48%,#fff 100%);padding:clamp(56px,7vw,100px) 0;color:#fff;overflow:hidden}#contact-us .contact-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;display:grid;grid-template-columns:minmax(0,.92fr) minmax(360px,520px);gap:clamp(28px,5vw,72px);align-items:center}#contact-us .contact-copy{min-width:0;max-width:720px}#contact-us .contact-eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:16px;color:#fbbf24;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}#contact-us h2{margin:0 0 18px;font-size:clamp(34px,4.4vw,62px);line-height:1.03;letter-spacing:0;color:#fff}#contact-us .contact-intro{margin:0 0 28px;max-width:650px;color:rgba(255,255,255,.78);font-size:clamp(15px,1.2vw,18px);line-height:1.72}#contact-us .contact-methods{list-style:none;padding:0;margin:0 0 24px;display:grid;gap:10px}#contact-us .contact-methods li{display:grid;grid-template-columns:30px 78px minmax(0,1fr);gap:10px;align-items:center;min-height:46px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);padding:10px 14px}#contact-us .contact-methods svg{width:20px;height:20px;color:#fbbf24}#contact-us .contact-methods span{color:rgba(255,255,255,.62);font-size:12px;text-transform:uppercase;font-weight:800}#contact-us .contact-methods b{min-width:0;color:#fff;font-size:14px;overflow-wrap:anywhere}#contact-us .contact-proof{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#contact-us .contact-proof li{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.84);font-weight:700;line-height:1.45}#contact-us .contact-proof svg{flex:0 0 18px;width:18px;height:18px;color:#fbbf24;margin-top:2px}#contact-us .contact-form-panel{background:#fff;color:#101828;box-shadow:0 28px 80px rgba(4,12,24,.22);padding:clamp(24px,3vw,38px);border-top:5px solid #f97316}#contact-us .contact-form-panel h3{margin:0 0 8px;font-size:clamp(24px,2.4vw,34px);line-height:1.15;color:#0b1f35}#contact-us .contact-form-panel p{margin:0 0 22px;color:#667085;line-height:1.6}#contact-us .contact-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#contact-us .contact-field{display:grid;gap:7px;min-width:0}#contact-us .contact-field span{font-size:12px;font-weight:900;color:#344054;text-transform:uppercase;letter-spacing:.04em}#contact-us input,#contact-us textarea{width:100%;border:1px solid #d7dee8;background:#f8fafc;color:#101828;padding:13px 14px;font:inherit;outline:none;border-radius:0}#contact-us input:focus,#contact-us textarea:focus{border-color:#f97316;background:#fff;box-shadow:0 0 0 3px rgba(249,115,22,.14)}#contact-us .contact-field-wide{grid-column:1/-1}#contact-us textarea{min-height:128px;resize:vertical}#contact-us .contact-submit{grid-column:1/-1;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;border:0;background:#f97316;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}#contact-us .contact-submit svg{width:18px;height:18px}#contact-us .contact-note{grid-column:1/-1;margin:0;color:#667085;font-size:13px;line-height:1.55}@media(max-width:980px){#contact-us{background:#0b1f35}#contact-us .contact-wrap{grid-template-columns:1fr;align-items:start}#contact-us .contact-form-panel{max-width:680px;width:100%;justify-self:start}#contact-us .contact-proof{grid-template-columns:1fr}}@media(max-width:640px){#contact-us{padding:46px 0}#contact-us .contact-wrap{width:min(100% - 32px,680px);gap:24px}#contact-us h2{font-size:34px}#contact-us .contact-methods li{grid-template-columns:26px 1fr;gap:8px}#contact-us .contact-methods b{grid-column:2}#contact-us .contact-form{grid-template-columns:1fr}#contact-us .contact-form-panel{padding:22px}}</style><div class="contact-wrap"><div class="contact-copy"><span class="contact-eyebrow">Start Your Project</span><h2>Tell Us About Your Project Requirements</h2><p class="contact-intro">${htmlEscape(text || company.description || "Share your product needs, target market, and delivery expectations. Our team will review the details and prepare a practical proposal for your next B2B website or sourcing project.")}</p><ul class="contact-methods">${contactMethods}</ul><ul class="contact-proof">${proofItems}</ul></div><div class="contact-form-panel"><h3>Request a Free Proposal</h3><p>Your details go straight to our engineering and sales team.</p><form class="contact-form" action="#contact-us" method="post"><label class="contact-field"><span>Your name*</span><input name="name" type="text" autocomplete="name" required placeholder="Your name"></label><label class="contact-field"><span>Country</span><input name="country" type="text" autocomplete="country-name" placeholder="Your country"></label><label class="contact-field"><span>Email*</span><input name="email" type="email" autocomplete="email" required placeholder="name@company.com"></label><label class="contact-field"><span>Product / project type</span><input name="product_type" type="text" placeholder="${htmlEscape(categories[0] || "Industrial products")}"></label><label class="contact-field contact-field-wide"><span>Target capacity / quantity</span><input name="target_capacity" type="text" placeholder="e.g. 500 units per month"></label><label class="contact-field contact-field-wide"><span>Project details</span><textarea name="message" placeholder="Tell us about your project, required products, delivery schedule, and technical notes."></textarea></label><button class="contact-submit" type="submit">SEND INQUIRY ${svgUse("icon-send")}</button><p class="contact-note">This fixed inquiry form is reserved for future CRM/agent integration and can be connected to the lead pipeline later.</p></form></div></div></section>`;
        }
        if (!aiSiteSectionLabel(sectionKey)) {
            const sectionId = sectionKey.replace(/_/g, "-");
            return `<section class="ai-section custom-page-basic ${generated ? "" : "placeholder"}" id="${sectionId}"><style>#${sectionId}{background:#fff;padding:clamp(56px,7vw,96px) 0;color:#16202e}#${sectionId} .custom-page-wrap{width:min(1120px,calc(100vw - clamp(32px,6vw,120px)));margin:auto}#${sectionId} .custom-page-shell{border:1px solid #e2e7ee;background:#f8fafc;padding:clamp(28px,4vw,54px)}#${sectionId} .custom-page-eyebrow{display:inline-flex;color:#c8161c;font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:12px;margin-bottom:12px}#${sectionId} h2{margin:0 0 16px;font-size:clamp(30px,4vw,48px);line-height:1.08;color:#0c1b33}#${sectionId} p{max-width:760px;margin:0;color:#5f6b7a;font-size:clamp(15px,1.3vw,18px);line-height:1.75}#${sectionId} .custom-page-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}#${sectionId} a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:4px;background:#143a7b;color:#fff;font-weight:800;text-decoration:none}#${sectionId} a.secondary{background:#fff;color:#143a7b;border:1px solid #cfd8e6}@media(max-width:760px){#${sectionId}{padding:48px 0}#${sectionId} .custom-page-wrap{width:min(100% - 32px,680px)}#${sectionId} .custom-page-actions a{width:100%}}</style><div class="custom-page-wrap"><div class="custom-page-shell"><span class="custom-page-eyebrow">${htmlEscape(generatedBadge)}</span><h2>${htmlEscape(sectionLabel)}</h2><p>${htmlEscape(text)}</p><div class="custom-page-actions"><a href="#contact-us">Request a Proposal</a><a class="secondary" href="#products">View Products</a></div></div></div></section>`;
        }
        const panelCards = [1, 2, 3].map((index) => `<article class="ai-card"><h3>${htmlEscape(sectionLabel)} ${index}</h3><p>${htmlEscape(text)}</p></article>`).join("");
        return `<section class="ai-section ${generated ? "" : "placeholder"}" id="${sectionKey.replace(/_/g, "-")}"><div class="ai-wrap"><div class="ai-section-head"><span class="ai-eyebrow">${generatedBadge}</span><h2 class="ai-section-title">${htmlEscape(sectionLabel)}</h2><p class="ai-section-sub">${htmlEscape(text)}</p></div><div class="ai-grid">${panelCards}</div></div></section>`;
        if (sectionKey === "header") {
            const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<a href="#products">${htmlEscape(item)}</a>`).join("");
            return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--ink:#101828;--muted:#667085;--line:#e5e7eb;--brand:#3157d5;--accent:#16a34a;--bg:#ffffff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}.container{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.topbar{background:#0f172a;color:#e2e8f0;font-size:13px}.topbar .container{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.socials{display:flex;gap:12px;color:#93c5fd;flex-wrap:wrap}.header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.header .container{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:clamp(20px,1.8vw,26px);font-weight:850;white-space:nowrap}.brand span{color:var(--brand)}.nav{display:flex;align-items:center;gap:clamp(14px,1.6vw,28px);font-size:14px;flex-wrap:wrap}.nav-item{position:relative}.dropdown{display:none;position:absolute;top:28px;left:0;width:min(300px,80vw);padding:12px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 45px rgba(15,23,42,.12)}.nav-item:hover .dropdown{display:grid;gap:8px}.header-cta{display:flex;align-items:center;gap:10px;white-space:nowrap}.phone{font-weight:800;color:var(--brand)}.send-inquiry{display:none;padding:10px 14px;border-radius:4px;background:var(--brand);color:#fff;font-weight:800}section{padding:clamp(56px,7vw,112px) 0;border-bottom:1px solid #eef2f7;overflow:hidden}.eyebrow{color:var(--brand);font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.hero{background:linear-gradient(135deg,#f8fafc,#eef6ff)}.hero h1{font-size:clamp(36px,4.4vw,68px);line-height:1.05;margin:12px 0 18px;max-width:880px}.hero p{font-size:clamp(16px,1.4vw,19px);color:var(--muted);max-width:760px;line-height:1.75}.btn-row{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}.primary-btn,.ghost-btn{padding:13px 18px;border-radius:4px;font-weight:800}.primary-btn{background:var(--brand);color:white}.ghost-btn{border:1px solid var(--line);background:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:clamp(16px,2vw,30px)}.card{border:1px solid var(--line);padding:clamp(18px,2vw,28px);border-radius:6px;background:white;min-width:0}.card h3{margin:0 0 8px}.card p{color:var(--muted);line-height:1.7}.footer{background:#101828;color:#d0d5dd}.footer-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:clamp(22px,3vw,44px);padding:clamp(46px,6vw,72px) 0}.footer h3,.footer h4{color:#fff}.footer a,.footer p{color:#d0d5dd}.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98a2b3}.to-top{float:right;color:#fff}.placeholder{background:#f8fafc}.placeholder .card{border-style:dashed}@media(max-width:900px){.nav{display:none}.send-inquiry{display:inline-flex}.phone{display:none}}@media(max-width:760px){.container{width:min(100% - 36px,680px)}.topbar .container,.header .container{align-items:flex-start;justify-content:flex-start;padding:10px 0}.hero h1{font-size:36px}}
</style></head><body><div class="topbar"><div class="container"><span>Port: Qingdao / Shanghai · Global B2B Industrial Supply</span><span class="socials">LinkedIn · YouTube · Facebook</span></div></div><header class="header"><div class="container"><a class="brand" href="#home">${brandWithHighlight(brand)}</a><nav class="nav"><a href="#home">Home</a><div class="nav-item"><a href="#products">Products</a><div class="dropdown">${productItems}</div></div><a href="#applications">Applications</a><a href="#about-us">About Us</a><a href="#blog">Blog</a><a href="#contact-us">Contact Us</a></nav><div class="header-cta"><span class="phone">${htmlEscape(contact.phone || "+86-0000-0000")}</span><a class="send-inquiry" href="#contact-us">SEND INQUIRY</a></div></div></header>`;
        }
        if (sectionKey === "footer") {
            const solutionItems = (solutions.length ? solutions : ["OEM supply", "Process automation", "Distributor support"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
            const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
            return `<footer class="footer"><div class="container footer-top"><div><h3 class="brand">${brandWithHighlight(brand)}</h3><p>${htmlEscape(company.tagline || "Reliable industrial supply for global B2B buyers.")}</p><p>${htmlEscape(company.description || "We help overseas buyers source stable industrial products with responsive service and clear documentation.")}</p></div><div><h4>Solutions</h4><ul>${solutionItems}</ul></div><div><h4>Products</h4><ul>${productItems}</ul></div><div><h4>Contact</h4><p>${htmlEscape(contact.email || "sales@example.com")}</p><p>${htmlEscape(contact.phone || "+86-0000-0000")}</p><p>${htmlEscape(contact.address || "China")}</p></div></div><div class="container footer-bottom">© ${new Date().getFullYear()} ${htmlEscape(brand)}. All rights reserved. <a href="#home" id="toTop" class="to-top">Back to top</a></div></footer></body></html>`;
        }
        const legacyText = blueprint[sectionKey] || aiSiteSectionLabel(sectionKey);
        if (sectionKey === "hero") {
            return `<section class="hero ${generated ? "" : "placeholder"}" id="home"><div class="container"><span class="eyebrow">${generatedBadge}</span><h1>${htmlEscape(company.tagline || `${brand} Industrial Solutions`)}</h1><p>${htmlEscape(legacyText)}</p><div class="btn-row"><a class="primary-btn" href="#contact-us">Send Inquiry</a><a class="ghost-btn" href="#products">View Products</a></div></div></section>`;
        }
        const cards = [1, 2, 3].map((index) => `<article class="card"><h3>${htmlEscape(aiSiteSectionLabel(sectionKey))} ${index}</h3><p>${htmlEscape(legacyText)}</p></article>`).join("");
        return `<section class="${generated ? "" : "placeholder"}" id="${sectionKey.replace(/_/g, "-")}"><div class="container"><span class="eyebrow">${generatedBadge}</span><h2>${htmlEscape(aiSiteSectionLabel(sectionKey))}</h2><div class="grid">${cards}</div></div></section>`;
    }
    async function ensureAiSiteSandbox(project) {
        const root = aiProjectDir(project.id);
        const sectionsDir = path.join(root, "sections");
        await mkdir(sectionsDir, { recursive: true });
        await writeFile(aiProjectMetaFile(project.id), JSON.stringify(project, null, 2), "utf8");
        await writeFile(path.join(root, "form.json"), JSON.stringify(project.schemaData || {}, null, 2), "utf8");
        const blueprintPath = path.join(root, "blueprint.json");
        const blueprintText = await readFile(blueprintPath, "utf8").catch(() => "");
        if (!blueprintText || looksCorruptAiSiteText(blueprintText))
            await writeFile(blueprintPath, JSON.stringify(cleanAiSiteBlueprint(project), null, 2), "utf8");
        await writeFile(aiSiteDesignSystemFile(project.id), JSON.stringify(aiSiteDesignSystem(project), null, 2), "utf8");
        await writeFile(aiSiteVariantRegistryFile(project.id), JSON.stringify(aiSiteVariantRegistryMeta(), null, 2), "utf8");
        const orderPath = path.join(root, "order.json");
        if (!(await fileExists(orderPath)))
            await writeFile(orderPath, JSON.stringify(aiSiteSectionKeys, null, 2), "utf8");
        const headerPath = aiSectionFile(project.id, "header");
        const footerPath = aiSectionFile(project.id, "footer");
        await writeFile(headerPath, defaultAiSectionHtml("header", project, true), "utf8");
        await writeFile(footerPath, defaultAiSectionHtml("footer", project, true), "utf8");
    }
    async function persistAiSiteSettingsLocal(settings) {
        await mkdir(aiBuildRoot(), { recursive: true });
        await writeFile(aiSiteSettingsFile(), JSON.stringify(settings, null, 2), "utf8");
    }
    function projectFromSandbox(projectId, schemaData, user) {
        const schema = normalizeAiSiteSchemaData(schemaData);
        const company = schema.company_profile;
        const taxonomy = schema.business_taxonomy;
        const pages = ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
        return {
            id: projectId,
            taskName: `${company.legal_name || company.wordmark || "未命名网站"} 建站任务`,
            siteName: company.legal_name || company.wordmark || "未命名网站",
            industry: taxonomy.product_categories[0] || "未指定行业",
            goal: "lead-generation",
            tone: schema.style_requirements.preset || "industrial-professional",
            pages,
            schemaData: schema,
            agentPayload: normalizeAgentPayload(undefined, schema, pages),
            status: "draft_reserved",
            ownerId: user.id,
            teamId: user.teamId,
            createdAt: new Date().toISOString()
        };
    }
    async function hydrateAiSiteLocalState(user) {
        const store = getStore();
        await mkdir(aiBuildRoot(), { recursive: true });
        const localSettings = await readJsonFile(aiSiteSettingsFile(), []);
        for (const setting of localSettings) {
            if (!store.aiSiteBuilderSettings.some((item) => item.ownerId === setting.ownerId))
                store.aiSiteBuilderSettings.push(setting);
        }
        for (const setting of store.aiSiteBuilderSettings) {
            if (!localSettings.some((item) => item.ownerId === setting.ownerId))
                localSettings.push(setting);
        }
        if (localSettings.length)
            await persistAiSiteSettingsLocal(localSettings);
        const entries = await readdir(aiBuildRoot(), { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith("_"))
                continue;
            const projectId = entry.name;
            if (store.aiSiteBuilderProjects.some((item) => item.id === projectId))
                continue;
            const meta = await readJsonFile(aiProjectMetaFile(projectId), null);
            if (meta?.id) {
                store.aiSiteBuilderProjects.push(meta);
                continue;
            }
            const schemaData = await readJsonFile(path.join(aiProjectDir(projectId), "form.json"), null);
            if (schemaData) {
                const restored = projectFromSandbox(projectId, schemaData, user);
                store.aiSiteBuilderProjects.push(restored);
                await ensureAiSiteSandbox(restored);
            }
        }
        for (const project of store.aiSiteBuilderProjects)
            await ensureAiSiteSandbox(project);
    }
    async function readAiSiteOrder(project) {
        await ensureAiSiteSandbox(project);
        const raw = await readFile(path.join(aiProjectDir(project.id), "order.json"), "utf8").catch(() => "[]");
        let parsed = [];
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            parsed = [];
        }
        const middle = Array.isArray(parsed) ? parsed.map(String).filter((item) => isAiSiteSectionKey(item) && !aiSiteLockedSections.has(item)) : [];
        const uniqueMiddle = [...new Set(middle)];
        const fallbackMiddle = aiSiteSectionKeys.filter((item) => !aiSiteLockedSections.has(item));
        return ["header", ...(uniqueMiddle.length ? uniqueMiddle : fallbackMiddle), "footer"];
    }
    async function writeAiSiteOrder(project, order) {
        const middle = order.filter((item) => isAiSiteSectionKey(item) && !aiSiteLockedSections.has(item));
        const uniqueMiddle = [...new Set(middle)];
        const fallbackMiddle = aiSiteSectionKeys.filter((item) => !aiSiteLockedSections.has(item));
        const nextOrder = ["header", ...(uniqueMiddle.length ? uniqueMiddle : fallbackMiddle), "footer"];
        await ensureAiSiteSandbox(project);
        await writeFile(path.join(aiProjectDir(project.id), "order.json"), JSON.stringify(nextOrder, null, 2), "utf8");
        return nextOrder;
    }
    function sanitizeAiSiteExportFragment(html) {
        if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
            throw new Error("区块疑似包含 CRM 主系统内容，已拒绝导出");
        }
        return html
            .replace(/<!doctype[^>]*>/gi, "")
            .replace(/<html[^>]*>/gi, "")
            .replace(/<\/html>/gi, "")
            .replace(/<head[\s\S]*?<\/head>/gi, "")
            .replace(/<body[^>]*>/gi, "")
            .replace(/<\/body>/gi, "")
            .replace(/<svg[^>]*data-ai-site-sprite=["']xinhai-reference["'][\s\S]*?<\/svg>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
            .replace(/\shref\s*=\s*"(?!#|mailto:|tel:)[^"]*"/gi, " href=\"#\"")
            .replace(/\shref\s*=\s*'(?!#|mailto:|tel:)[^']*'/gi, " href=\"#\"")
            .replace(/\starget\s*=\s*"[^"]*"/gi, "")
            .replace(/\starget\s*=\s*'[^']*'/gi, "")
            .trim();
    }
    const aiSiteWpRouteLinks = {
        "#home": "/",
        "#top": "/",
        "#products": "/products/",
        "#applications": "/applications/",
        "#about": "/about-us/",
        "#about-us": "/about-us/",
        "#about_us": "/about-us/",
        "#blog": "/blog/",
        "#news": "/blog/",
        "#contact": "/contact-us/",
        "#contact-us": "/contact-us/",
        "#contact_us": "/contact-us/"
    };
    function rewriteAiSiteWpRouteLinks(html) {
        return html.replace(/<a\b([^>]*?)\shref=(["'])(#[^"']*)\2/gi, (match, before, quote, href) => {
            const target = aiSiteWpRouteLinks[href.toLowerCase()];
            if (!target)
                return match;
            return `<a${before} href=${quote}${target}${quote}`;
        });
    }
    function sanitizeAiSiteWpExportFragment(html) {
        return rewriteAiSiteWpRouteLinks(sanitizeAiSiteExportFragment(html));
    }
    function buildAiSiteExportDocument(project, fragments) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const company = schema.company_profile;
        const title = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
        const description = company.description || company.tagline || "B2B industrial website generated by GoodJob AI Website Factory.";
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><style>${aiSiteFrameworkCss(project)}</style></head><body>${aiSiteIconSprite()}${fragments.map(sanitizeAiSiteExportFragment).join("\n")}</body></html>`;
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><style>
:root{--ink:#101828;--muted:#667085;--line:#e5e7eb;--brand:#3157d5;--accent:#16a34a;--bg:#ffffff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}.container{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.topbar{background:#0f172a;color:#e2e8f0;font-size:13px}.topbar .container{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.socials{display:flex;gap:12px;color:#93c5fd;flex-wrap:wrap}.header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.header .container{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:clamp(20px,1.8vw,26px);font-weight:850;white-space:nowrap}.brand span{color:var(--brand)}.nav{display:flex;align-items:center;gap:clamp(14px,1.6vw,28px);font-size:14px;flex-wrap:wrap}.nav-item{position:relative}.dropdown{display:none;position:absolute;top:28px;left:0;width:min(300px,80vw);padding:12px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 45px rgba(15,23,42,.12)}.nav-item:hover .dropdown{display:grid;gap:8px}.header-cta{display:flex;align-items:center;gap:10px;white-space:nowrap}.phone{font-weight:800;color:var(--brand)}.send-inquiry{display:none;padding:10px 14px;border-radius:4px;background:var(--brand);color:#fff;font-weight:800}section{padding:clamp(56px,7vw,112px) 0;border-bottom:1px solid #eef2f7;overflow:hidden}.eyebrow{color:var(--brand);font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.hero{background:linear-gradient(135deg,#f8fafc,#eef6ff)}.hero h1{font-size:clamp(36px,4.4vw,68px);line-height:1.05;margin:12px 0 18px;max-width:880px}.hero p{font-size:clamp(16px,1.4vw,19px);color:var(--muted);max-width:760px;line-height:1.75}.btn-row{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}.primary-btn,.ghost-btn{padding:13px 18px;border-radius:4px;font-weight:800}.primary-btn{background:var(--brand);color:white}.ghost-btn{border:1px solid var(--line);background:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:clamp(16px,2vw,30px)}.card{border:1px solid var(--line);padding:clamp(18px,2vw,28px);border-radius:6px;background:white;min-width:0}.card h3{margin:0 0 8px}.card p{color:var(--muted);line-height:1.7}.footer{background:#101828;color:#d0d5dd}.footer-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:clamp(22px,3vw,44px);padding:clamp(46px,6vw,72px) 0}.footer h3,.footer h4{color:#fff}.footer a,.footer p{color:#d0d5dd}.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98a2b3}.to-top{float:right;color:#fff}.placeholder{background:#f8fafc}.placeholder .card{border-style:dashed}@media(max-width:900px){.nav{display:none}.send-inquiry{display:inline-flex}.phone{display:none}}@media(max-width:760px){.container{width:min(100% - 36px,680px)}.topbar .container,.header .container{align-items:flex-start;justify-content:flex-start;padding:10px 0}.hero h1{font-size:36px}}
</style></head><body>${fragments.map(sanitizeAiSiteExportFragment).join("\n")}</body></html>`;
    }
    async function exportAiSiteProject(project, orderInput) {
        await ensureAiSiteSandbox(project);
        const order = orderInput?.length ? await writeAiSiteOrder(project, orderInput) : await readAiSiteOrder(project);
        const fragments = await Promise.all(order.map(async (sectionKey) => {
            const file = aiSectionFile(project.id, sectionKey);
            if (await fileExists(file))
                return readFile(file, "utf8");
            return defaultAiSectionHtml(sectionKey, project, false);
        }));
        const distDir = aiExportDir(project.id);
        await mkdir(distDir, { recursive: true });
        const html = buildAiSiteExportDocument(project, fragments);
        const indexPath = path.join(distDir, "index.html");
        const exportedAt = new Date().toISOString();
        await writeFile(indexPath, html, "utf8");
        const customPages = await readAiSiteCustomPages(project);
        const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
        const manifest = {
            projectId: project.id,
            siteName: project.siteName,
            exportedAt,
            order,
            indexPath,
            wpMetadata
        };
        await writeFile(path.join(distDir, "export.json"), JSON.stringify(manifest, null, 2), "utf8");
        return manifest;
    }
    async function readAiSiteProjectExport(project, includeHtml = false) {
        await ensureAiSiteSandbox(project);
        const manifest = await readJsonFile(path.join(aiExportDir(project.id), "export.json"), null);
        const indexPath = typeof manifest?.indexPath === "string" ? manifest.indexPath : path.join(aiExportDir(project.id), "index.html");
        const exported = Boolean(manifest && await fileExists(indexPath));
        const html = exported && includeHtml ? await readFile(indexPath, "utf8").catch(() => "") : "";
        return {
            exported,
            export: exported ? manifest : null,
            html
        };
    }
    function cleanAiSiteWpThemeSlug(value, fallback = "goodjob-ai-site") {
        const slug = String(value ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 64);
        return slug || fallback;
    }
    function cleanAiSiteWpHeaderValue(value, fallback) {
        const text = String(value ?? fallback)
            .replace(/[\r\n\t]+/g, " ")
            .replace(/\*\//g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 140);
        return text || fallback;
    }
    function aiSiteWpBlockSlug(sectionKey) {
        return cleanAiSiteWpThemeSlug(sectionKey.replace(/_/g, "-"), "section");
    }
    function aiSitePhpString(value) {
        return JSON.stringify(String(value ?? ""));
    }
    function aiSitePhpNowdoc(identifier, value) {
        const safeIdentifier = identifier.replace(/[^A-Z0-9_]/gi, "_").toUpperCase() || "GOODJOB_HTML";
        return `<<<'${safeIdentifier}'\n${value.replace(/\r\n/g, "\n").replace(/\r/g, "\n")}\n${safeIdentifier}`;
    }
    function aiSiteWpFieldKey(sectionKey, fieldName) {
        return `field_goodjob_${sectionKey.replace(/[^a-z0-9_]/gi, "_")}_${fieldName}`;
    }
    function aiSiteWpTextFromHtml(html, selector) {
        const source = selector === "title"
            ? html.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
            : html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
        return cleanHtml((source || "").replace(/<[^>]+>/g, " ")).slice(0, selector === "title" ? 90 : 260);
    }
    function aiSitePlaceholderImage(width, height, bg, fg, text) {
        const safeText = encodeURIComponent(text.replace(/&/g, "and")).replace(/%20/g, "+");
        return `https://placehold.co/${width}x${height}/${bg}/${fg}?text=${safeText}`;
    }
    function aiSiteWpStyleTagFromHtml(html) {
        return html.match(/<style\b[^>]*>[\s\S]*?<\/style>/i)?.[0] || "";
    }
    function aiSiteWpCptAdapterStyle(sectionKey) {
        if (sectionKey === "products") {
            return `<style data-goodjob-cpt-adapter="products">
#products.goodjob-cpt-products{overflow:hidden}
#products.goodjob-cpt-products .products-wrap{width:min(1280px,calc(100vw - clamp(32px,6vw,120px)))!important;max-width:none!important;margin-inline:auto!important}
#products.goodjob-cpt-products .products-stage{overflow:visible!important}
#products.goodjob-cpt-products .products-pages{overflow:visible!important}
#products.goodjob-cpt-products [data-product-category-panel][hidden]{display:none!important}
#products.goodjob-cpt-products [data-product-category-panel]{display:block!important;width:100%!important;min-width:0!important;transform:none!important}
#products.goodjob-cpt-products .products-track{display:block!important;width:100%!important;min-width:0!important;transform:none!important;transition:none!important}
#products.goodjob-cpt-products .products-page{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:clamp(18px,2vw,28px)!important;width:100%!important;min-width:0!important}
#products.goodjob-cpt-products .product-card{display:flex!important;flex-direction:column!important;min-width:0!important;height:100%!important;overflow:hidden!important}
#products.goodjob-cpt-products .product-media{display:block!important;width:100%!important;aspect-ratio:1/1!important;min-height:0!important;max-height:none!important;overflow:hidden!important;flex:0 0 auto!important}
#products.goodjob-cpt-products .product-media img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important}
#products.goodjob-cpt-products .product-body{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;gap:10px!important;min-height:150px!important;padding:clamp(14px,1.7vw,22px)!important}
#products.goodjob-cpt-products .product-name{margin:0!important;overflow-wrap:anywhere}
#products.goodjob-cpt-products .product-name a{color:inherit!important;text-decoration:none!important}
#products.goodjob-cpt-products .product-copy{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#products.goodjob-cpt-products .product-meta{margin-top:auto!important;min-width:0!important}
#products.goodjob-cpt-products .product-arrow{flex:0 0 auto}
#products.goodjob-cpt-products .products-empty{grid-column:1/-1;margin:0;padding:22px;background:rgba(255,255,255,.9);color:#344054}
@media(max-width:1100px){#products.goodjob-cpt-products .products-page{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:640px){#products.goodjob-cpt-products .products-wrap{width:min(100% - 32px,680px)!important}#products.goodjob-cpt-products .products-page{grid-template-columns:1fr!important}#products.goodjob-cpt-products .product-media{aspect-ratio:4/3!important}}
</style>`;
        }
        return `<style data-goodjob-cpt-adapter="blog">
#blog.goodjob-cpt-blog{overflow:hidden}
#blog.goodjob-cpt-blog .blog-wrap{width:min(1280px,calc(100vw - clamp(32px,6vw,120px)))!important;max-width:none!important;margin-inline:auto!important}
#blog.goodjob-cpt-blog .blog-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:clamp(18px,3vw,36px)!important;align-items:end!important}
#blog.goodjob-cpt-blog .blog-content{display:grid!important;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr)!important;gap:clamp(18px,2.6vw,34px)!important;align-items:start!important}
#blog.goodjob-cpt-blog .blog-feature{display:block!important;margin:0!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-feature-card{overflow:hidden!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-feature-media{display:block!important;width:100%!important;aspect-ratio:16/9!important;min-height:0!important;max-height:460px!important;overflow:hidden!important}
#blog.goodjob-cpt-blog .blog-feature-media img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
#blog.goodjob-cpt-blog .blog-feature-body{padding:clamp(20px,3vw,34px)!important}
#blog.goodjob-cpt-blog .blog-meta{display:flex!important;flex-wrap:wrap!important;gap:10px!important;align-items:center!important;margin-bottom:12px!important}
#blog.goodjob-cpt-blog .blog-list{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;align-content:start!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-row{display:block!important;min-width:0!important;overflow:hidden!important;padding:clamp(14px,1.6vw,20px)!important}
#blog.goodjob-cpt-blog .blog-row-media{display:none!important}
#blog.goodjob-cpt-blog .blog-row-media img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
#blog.goodjob-cpt-blog .blog-row-title{color:inherit!important;text-decoration:none!important;overflow-wrap:anywhere}
#blog.goodjob-cpt-blog .blog-row p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:980px){#blog.goodjob-cpt-blog .blog-content{grid-template-columns:1fr!important}#blog.goodjob-cpt-blog .blog-list{grid-template-columns:1fr!important}}
@media(max-width:820px){#blog.goodjob-cpt-blog .blog-head{grid-template-columns:1fr!important}}
@media(max-width:560px){#blog.goodjob-cpt-blog .blog-wrap{width:min(100% - 32px,680px)!important}#blog.goodjob-cpt-blog .blog-row{grid-template-columns:1fr!important}#blog.goodjob-cpt-blog .blog-feature-media{aspect-ratio:16/9!important}}
</style>`;
    }
    function buildAiSiteWpAcfFieldGroup(section, fragment) {
        const sectionKey = section.section_key;
        const blockSlug = aiSiteWpBlockSlug(sectionKey);
        const title = aiSiteWpTextFromHtml(fragment, "title") || section.label;
        const intro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
        return {
            key: `group_goodjob_block_${blockSlug}`,
            title: `GoodJob Block - ${section.label}`,
            fields: [
                {
                    key: aiSiteWpFieldKey(sectionKey, "eyebrow"),
                    label: "Eyebrow",
                    name: "eyebrow",
                    type: "text",
                    default_value: section.label,
                    wrapper: { width: "33" }
                },
                {
                    key: aiSiteWpFieldKey(sectionKey, "title"),
                    label: "Title",
                    name: "title",
                    type: "text",
                    default_value: title,
                    wrapper: { width: "67" }
                },
                {
                    key: aiSiteWpFieldKey(sectionKey, "intro"),
                    label: "Intro",
                    name: "intro",
                    type: "textarea",
                    rows: 3,
                    default_value: intro
                },
                {
                    key: aiSiteWpFieldKey(sectionKey, "primary_label"),
                    label: "Primary Button Label",
                    name: "primary_label",
                    type: "text",
                    default_value: "Request a Proposal",
                    wrapper: { width: "50" }
                },
                {
                    key: aiSiteWpFieldKey(sectionKey, "primary_url"),
                    label: "Primary Button URL",
                    name: "primary_url",
                    type: "url",
                    default_value: "/contact-us/",
                    wrapper: { width: "50" }
                },
                {
                    key: aiSiteWpFieldKey(sectionKey, "image"),
                    label: "Image",
                    name: "image",
                    type: "image",
                    return_format: "array",
                    preview_size: "medium",
                    instructions: "Recommended upload size depends on the block: hero 1920x780, product 800x700, blog/case 800x600."
                },
                ...(sectionKey === "hero" ? [
                    {
                        key: aiSiteWpFieldKey(sectionKey, "hero_bg_1"),
                        label: "Hero Background 1",
                        name: "hero_bg_1",
                        type: "image",
                        return_format: "array",
                        preview_size: "large",
                        instructions: "Main hero carousel background. Recommended upload size: 1920x780 or larger.",
                        wrapper: { width: "33" }
                    },
                    {
                        key: aiSiteWpFieldKey(sectionKey, "hero_bg_2"),
                        label: "Hero Background 2",
                        name: "hero_bg_2",
                        type: "image",
                        return_format: "array",
                        preview_size: "large",
                        instructions: "Second hero carousel background. Recommended upload size: 1920x780 or larger.",
                        wrapper: { width: "33" }
                    },
                    {
                        key: aiSiteWpFieldKey(sectionKey, "hero_bg_3"),
                        label: "Hero Background 3",
                        name: "hero_bg_3",
                        type: "image",
                        return_format: "array",
                        preview_size: "large",
                        instructions: "Third hero carousel background. Recommended upload size: 1920x780 or larger.",
                        wrapper: { width: "33" }
                    }
                ] : []),
                {
                    key: aiSiteWpFieldKey(sectionKey, "html_source"),
                    label: "Advanced HTML Source",
                    name: "html_source",
                    type: "textarea",
                    rows: 12,
                    instructions: "Optional. Leave empty to use structured fields or theme fallback. Use only when the exact generated section needs manual HTML editing."
                }
            ],
            location: [[{ param: "block", operator: "==", value: `acf/${blockSlug}` }]],
            menu_order: section.order_index,
            position: "normal",
            style: "default",
            label_placement: "top",
            instruction_placement: "label",
            active: true
        };
    }
    function buildAiSiteWpBlockJson(section) {
        const blockSlug = aiSiteWpBlockSlug(section.section_key);
        return {
            apiVersion: 2,
            name: `acf/${blockSlug}`,
            title: section.label,
            category: "goodjob-ai-site",
            icon: section.section_key === "hero" ? "cover-image" : section.section_key === "products" ? "products" : "layout",
            description: `${section.label} block generated by GoodJob AI Website Factory.`,
            keywords: ["goodjob", "ai-site", blockSlug],
            acf: {
                mode: "preview",
                renderTemplate: "render.php"
            },
            render: "file:./render.php",
            style: `file:./style.css`,
            attributes: {
                data: {
                    type: "object",
                    default: {}
                },
                mode: {
                    type: "string",
                    default: "preview"
                }
            },
            supports: {
                align: ["wide", "full"],
                mode: false,
                jsx: true
            }
        };
    }
    function buildAiSiteWpProductsHomeRender(section, fragment) {
        const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || "Product Category";
        const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || "Browse export-ready industrial products by category, compare typical models, and open a direct inquiry from the catalog.";
        const generatedStyle = `${aiSiteWpStyleTagFromHtml(fragment) || `<style>#products.products-category-showcase{background:#fff;padding:clamp(56px,7vw,92px) 0;color:#101828}#products .products-wrap{width:min(1440px,calc(100vw - 40px));margin:auto}#products .products-head{text-align:center;max-width:860px;margin:0 auto 28px}#products .products-tabs{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:0 0 24px}#products .products-tab{border:1px solid #d0d5dd;background:#fff;color:#101828;padding:10px 14px;font-weight:800;cursor:pointer}#products .products-tab.is-active{background:var(--blue,#244aa5);color:#fff;border-color:var(--blue,#244aa5)}#products .products-page{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}#products .product-card{background:#fff;border:1px solid #e4e7ec;color:#101828;text-decoration:none}#products .product-media{aspect-ratio:1/1;background:#f4f6fa;overflow:hidden}#products .product-media img{width:100%;height:100%;object-fit:contain;display:block}#products .product-body{padding:16px}#products .product-name{margin:0 0 8px;font-size:17px;line-height:1.25}#products .product-copy{margin:0;color:#667085;line-height:1.6}@media(max-width:960px){#products .products-page{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){#products .products-page{grid-template-columns:1fr}}</style>`}
${aiSiteWpCptAdapterStyle("products")}`;
        const categoryArray = ["Industrial Products", "OEM Components", "Export Assemblies", "Custom Parts"];
        const fallbackCategoryPhp = `array(${categoryArray.map((item) => aiSitePhpString(item)).join(", ")})`;
        const defaultStyle = aiSitePhpNowdoc(`GOODJOB_${section.section_key}_STYLE`, generatedStyle);
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = ${defaultStyle};
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'View All Products') : 'View All Products';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('product')) : get_post_type_archive_link('product');
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 8));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$fallback_categories = ${fallbackCategoryPhp};
$category_names = array();
foreach ($terms as $term) {
    if (!empty($term->name)) {
        $category_names[] = (string) $term->name;
    }
}
if (!$category_names) {
    $category_names = $fallback_categories;
}
$render_card = function ($category_label = '') {
    $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
    if (!$image_url) {
        $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
    }
    if (!$image_url) {
        $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
    }
    $label = $category_label;
    if (!$label) {
        $post_terms = get_the_terms(get_the_ID(), 'product_cat');
        if (!is_wp_error($post_terms) && is_array($post_terms) && !empty($post_terms[0]->name)) {
            $label = (string) $post_terms[0]->name;
        }
    }
    ?>
    <article class="product-card products-card">
      <a class="product-media" href="<?php the_permalink(); ?>">
        <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
      </a>
      <div class="product-body">
        <h3 class="product-name"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        <p class="product-copy"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 18)); ?></p>
        <div class="product-meta">
          <?php if ($label) : ?><span><?php echo esc_html($label); ?></span><?php endif; ?>
          <a class="product-arrow" href="<?php the_permalink(); ?>" aria-label="<?php the_title_attribute(); ?>">&#8594;</a>
        </div>
      </div>
    </article>
    <?php
};
?>
<section id="products" class="ai-section products-category-showcase goodjob-cpt-products">
  <?php echo $generated_style; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
  <div class="products-wrap">
    <div class="products-head">
      <span class="products-kicker">Product Category</span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
    </div>
    <div class="products-tabs" role="tablist">
      <?php foreach ($category_names as $index => $category_name) : ?>
        <button type="button" class="products-tab<?php echo $index === 0 ? ' is-active active' : ''; ?>" data-product-category="<?php echo esc_attr($category_name); ?>"><?php echo esc_html($category_name); ?></button>
      <?php endforeach; ?>
    </div>
    <div class="products-stage">
      <div class="products-pages">
        <?php foreach ($category_names as $index => $category_name) :
          $term = !empty($terms[$index]) ? $terms[$index] : null;
          $query_args = array(
              'post_type' => 'product',
              'post_status' => 'publish',
              'posts_per_page' => 4,
              'orderby' => 'menu_order date',
              'order' => 'DESC',
          );
          if ($term && !empty($term->term_id)) {
              $query_args['tax_query'] = array(array(
                  'taxonomy' => 'product_cat',
                  'field' => 'term_id',
                  'terms' => array((int) $term->term_id),
              ));
          }
          $products = new WP_Query($query_args);
          if (!$products->have_posts() && $index === 0) {
              wp_reset_postdata();
              $products = new WP_Query(array('post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => 4, 'orderby' => 'menu_order date', 'order' => 'DESC'));
          }
        ?>
          <div class="products-track<?php echo $index === 0 ? ' is-active' : ''; ?>" data-product-category-panel="<?php echo esc_attr($category_name); ?>"<?php echo $index === 0 ? '' : ' hidden'; ?>>
            <div class="products-page">
              <?php if ($products->have_posts()) : ?>
                <?php while ($products->have_posts()) : $products->the_post(); $render_card($category_name); endwhile; wp_reset_postdata(); ?>
              <?php else : ?>
                <p class="products-empty">No products are published for this category yet.</p>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
    <div class="products-actions goodjob-home-products__actions">
      <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('product')); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>`;
    }
    function buildAiSiteWpBlogHomeRender(section, fragment) {
        const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || "Recent Blogs";
        const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || "Read practical product guides, maintenance notes, and export buying insights from the latest News CPT content.";
        const generatedStyle = `${aiSiteWpStyleTagFromHtml(fragment) || `<style>#blog.blog-industrial-editorial-digest{background:#fff;padding:clamp(58px,7vw,96px) 0;color:#101828}#blog .blog-wrap{width:min(1440px,calc(100vw - 40px));margin:auto}#blog .blog-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:end;margin-bottom:28px}#blog .blog-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}#blog .blog-feature-card,#blog .blog-row{background:#fff;border:1px solid #e4e7ec}#blog .blog-feature-media,#blog .blog-row-media{display:block;aspect-ratio:16/9;background:#f4f6fa;overflow:hidden}#blog img{width:100%;height:100%;object-fit:cover;display:block}#blog .blog-feature-body,#blog .blog-row{padding:20px}#blog a{color:inherit}@media(max-width:820px){#blog .blog-head,#blog .blog-list{grid-template-columns:1fr}}</style>`}
${aiSiteWpCptAdapterStyle("blog")}`;
        const defaultStyle = aiSitePhpNowdoc(`GOODJOB_${section.section_key}_STYLE`, generatedStyle);
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = ${defaultStyle};
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'More Blogs') : 'More Blogs';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('news')) : get_post_type_archive_link('news');
$news_query = new WP_Query(array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 5,
    'orderby' => 'date',
    'order' => 'DESC',
));
$featured_id = 0;
?>
<section id="blog" class="ai-section blog-industrial-editorial-digest goodjob-cpt-blog" aria-labelledby="blog-title">
  <?php echo $generated_style; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
  <?php if ($news_query->have_posts()) : ?>
    <div class="blog-wrap ai-wrap">
      <div class="blog-head ai-section-head">
        <div>
          <span class="blog-eyebrow">Recent Blogs</span>
          <h2 id="blog-title"><?php echo esc_html($title); ?></h2>
          <p class="blog-intro"><?php echo esc_html($intro); ?></p>
        </div>
        <a class="blog-more ai-btn" href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('news')); ?>"><?php echo esc_html($primary_label); ?> <span aria-hidden="true">&#8594;</span></a>
      </div>
      <div class="blog-content">
      <div class="blog-feature">
        <?php $news_query->the_post(); $featured_id = get_the_ID();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/960x540/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
        <article class="blog-feature-card goodjob-featured-post ai-card">
          <a class="blog-feature-media goodjob-featured-post__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="blog-feature-body goodjob-featured-post__body">
            <div class="blog-meta">
              <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
              <span class="blog-tag">Buyer Guide</span>
            </div>
            <h3 class="blog-feature-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            <p class="blog-feature-text"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 28)); ?></p>
          </div>
        </article>
      </div>
      <div class="blog-list goodjob-home-blog__list" aria-label="Recent article list">
          <?php while ($news_query->have_posts()) : $news_query->the_post();
            if (get_the_ID() === $featured_id) {
                continue;
            }
            $row_image = get_the_post_thumbnail_url(get_the_ID(), 'medium_large');
            if (!$row_image) {
                $row_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$row_image) {
              $row_image = 'https://placehold.co/420x300/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="blog-row goodjob-blog-row ai-card">
              <a class="blog-row-media goodjob-blog-row__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($row_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              </a>
              <div>
                <time class="blog-date" datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
                <h3><a class="blog-row-title" href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 20)); ?></p>
              </div>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
      </div>
      </div>
    </div>
  <?php else : ?>
    <div class="blog-wrap"><p class="goodjob-home-blog__empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p></div>
  <?php endif; ?>
</section>`;
    }
    function buildAiSiteWpBlockRender(section, fragment) {
        if (section.section_key === "products")
            return buildAiSiteWpProductsHomeRender(section, fragment);
        if (section.section_key === "blog")
            return buildAiSiteWpBlogHomeRender(section, fragment);
        const blockSlug = aiSiteWpBlockSlug(section.section_key);
        const sectionId = section.section_key === "hero" ? "home" : section.section_key.replace(/_/g, "-");
        const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || section.label;
        const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
        const fallbackPrimaryLabel = section.section_key === "contact_us" ? "Send Inquiry" : "Request a Proposal";
        const fallbackPrimaryUrl = "/contact-us/";
        const defaultHtml = aiSitePhpNowdoc(`GOODJOB_${blockSlug}_HTML`, fragment);
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = ${defaultHtml};
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: ${aiSitePhpString(section.label)}) : ${aiSitePhpString(section.label)};
$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: ${aiSitePhpString(fallbackPrimaryLabel)}) : ${aiSitePhpString(fallbackPrimaryLabel)};
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: ${aiSitePhpString(fallbackPrimaryUrl)}) : ${aiSitePhpString(fallbackPrimaryUrl)};
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$hero_bg_urls = array();
foreach (array('hero_bg_1', 'hero_bg_2', 'hero_bg_3') as $hero_bg_field) {
    $hero_bg = function_exists('get_field') ? get_field($hero_bg_field) : null;
    $hero_bg_url = is_array($hero_bg) && !empty($hero_bg['url']) ? $hero_bg['url'] : (is_string($hero_bg) ? $hero_bg : '');
    if ($hero_bg_url) {
        $hero_bg_urls[] = $hero_bg_url;
    }
}
$has_structured_edits = $image_url
    || !empty($hero_bg_urls)
    || $eyebrow !== ${aiSitePhpString(section.label)}
    || $title !== ${aiSitePhpString(fallbackTitle)}
    || $intro !== ${aiSitePhpString(fallbackIntro)}
    || $primary_label !== ${aiSitePhpString(fallbackPrimaryLabel)}
    || $primary_url !== ${aiSitePhpString(fallbackPrimaryUrl)};
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== ${aiSitePhpString(section.label)}) {
        $editable_html = preg_replace_callback("/<(span|div)\\\\b([^>]*class=[\\"'][^\\"']*(?:eyebrow|badge|tag)[^\\"']*[\\"'][^>]*)>.*?<\\\\/\\\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== ${aiSitePhpString(fallbackTitle)}) {
        $editable_html = preg_replace_callback('/<h([1-3])\\b([^>]*)>.*?<\\/h\\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== ${aiSitePhpString(fallbackIntro)}) {
        $editable_html = preg_replace_callback('/<p\\b([^>]*)>.*?<\\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== ${aiSitePhpString(fallbackPrimaryLabel)} || $primary_url !== ${aiSitePhpString(fallbackPrimaryUrl)}) {
        $editable_html = preg_replace_callback("/<a\\\\b([^>]*?)href=([\\"']).*?\\\\2([^>]*)>.*?<\\\\/a>/is", function ($matches) use ($primary_label, $primary_url) {
            return '<a' . $matches[1] . 'href="' . esc_url($primary_url) . '"' . $matches[3] . '>' . esc_html($primary_label) . '</a>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if (!empty($hero_bg_urls)) {
        $hero_css = '<style data-goodjob-hero-acf-bg>';
        foreach ($hero_bg_urls as $index => $hero_bg_url) {
            $slide = $index + 1;
            $safe_url = esc_url($hero_bg_url);
            $hero_css .= '#home .bg' . $slide . ',#home [data-upload-slot="hero-background-' . $slide . '"],#home .hero-bg span:nth-child(' . $slide . '){background-image:url("' . $safe_url . '")!important;}';
        }
        $hero_css .= '</style>';
        $editable_html .= $hero_css;
    }
    echo $editable_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
?>
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('${blockSlug}'); ?>" id="<?php echo esc_attr('${sectionId}'); ?>">
  <div class="ai-wrap goodjob-acf-block__inner">
    <?php if ($image_url) : ?>
      <div class="goodjob-acf-block__media"><img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($title); ?>" loading="lazy" decoding="async"></div>
    <?php endif; ?>
    <div class="goodjob-acf-block__content">
      <span class="ai-eyebrow"><?php echo esc_html($eyebrow); ?></span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
      <a class="ai-btn ai-btn-primary" href="<?php echo esc_url($primary_url); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>
`;
    }
    function buildAiSiteWpBlockStyle(section) {
        const blockSlug = aiSiteWpBlockSlug(section.section_key);
        return `.goodjob-acf-block-${blockSlug}{background:var(--bg,#fff);padding:clamp(58px,7vw,104px) 0}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__inner{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.72fr);gap:clamp(26px,4vw,64px);align-items:center}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__media{aspect-ratio:16/10;background:#eef2f7;overflow:hidden}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__media img{width:100%;height:100%;object-fit:cover;display:block}
.goodjob-acf-block-${blockSlug} h2{margin:0 0 16px;color:var(--ink,#16202e);font-size:clamp(32px,4vw,52px);line-height:1.06}
.goodjob-acf-block-${blockSlug} p{color:var(--body,#3c4858);font-size:clamp(16px,1.3vw,19px);line-height:1.76;margin:0 0 24px}
@media(max-width:900px){.goodjob-acf-block-${blockSlug} .goodjob-acf-block__inner{grid-template-columns:1fr}.goodjob-acf-block-${blockSlug} .goodjob-acf-block__content{order:-1}}`;
    }
    function buildAiSiteWpPageBlock(section, fragment) {
        const blockSlug = aiSiteWpBlockSlug(section.section_key);
        const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || section.label;
        const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
        const data = {
            eyebrow: section.label,
            _eyebrow: aiSiteWpFieldKey(section.section_key, "eyebrow"),
            title: fallbackTitle,
            _title: aiSiteWpFieldKey(section.section_key, "title"),
            intro: fallbackIntro,
            _intro: aiSiteWpFieldKey(section.section_key, "intro"),
            primary_label: section.section_key === "contact_us" ? "Send Inquiry" : "Request a Proposal",
            _primary_label: aiSiteWpFieldKey(section.section_key, "primary_label"),
            primary_url: "/contact-us/",
            _primary_url: aiSiteWpFieldKey(section.section_key, "primary_url"),
            html_source: "",
            _html_source: aiSiteWpFieldKey(section.section_key, "html_source")
        };
        if (section.section_key === "hero") {
            for (const fieldName of ["hero_bg_1", "hero_bg_2", "hero_bg_3"]) {
                data[fieldName] = "";
                data[`_${fieldName}`] = aiSiteWpFieldKey(section.section_key, fieldName);
            }
        }
        const attrs = {
            name: `acf/${blockSlug}`,
            data,
            mode: "preview"
        };
        return `<!-- wp:acf/${blockSlug} ${JSON.stringify(attrs)} /-->`;
    }
    function buildAiSiteWpCollections(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const categories = sectionArray(schema.business_taxonomy.product_categories);
        const productCategories = (categories.length ? categories : ["Gate Valve", "Butterfly Valve", "Check Valve & Strainer", "Ball Valve", "Globe Valve", "Control Valve", "Other Valve And Fittings"]).slice(0, 10);
        const brand = schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName || "GoodJob";
        const primaryMarket = project.industry || schema.company_profile.tagline || "global industrial buyers";
        const productNameSuffixes = [
            "Ductile Iron Wafer Type",
            "Lug Type With Handle",
            "Double Stem Lug Type",
            "Flanged Gear Operated",
            "Stainless Steel Industrial",
            "Compact OEM Series",
            "Resilient Seated Model",
            "Heavy Duty Export Type"
        ];
        const genericProductSuffixes = [
            "Standard Export Model",
            "Precision OEM Series",
            "Heavy Duty Assembly",
            "Custom Manufacturing Unit",
            "Industrial Supply Version",
            "High Stability Project Type",
            "Inspection Ready Series",
            "Distributor Stock Option"
        ];
        const productImageColor = ["244aa5", "1f57b7", "2f6fc6", "315f9f", "4878d0", "113a7c"];
        const makeProductItems = (count) => Array.from({ length: count }, (_, index) => {
            const category = productCategories[index % productCategories.length] || "Industrial Products";
            const isValveCategory = /valve|strainer|fitting/i.test(category);
            const suffix = isValveCategory ? productNameSuffixes[index % productNameSuffixes.length] : genericProductSuffixes[index % genericProductSuffixes.length];
            const title = isValveCategory ? `${suffix} ${category}`.replace(/\s+/g, " ").trim() : `${category} ${suffix}`.replace(/\s+/g, " ").trim();
            const desc = `${brand} supplies ${category.toLowerCase()} options for industrial fluid control projects, with model confirmation, inspection records, export packing, and responsive RFQ support.`;
            const material = ["Carbon steel", "Stainless steel", "Aluminum alloy", "Custom alloy"][index % 4];
            const application = ["OEM assembly", "Process equipment", "Automation line", "Maintenance replacement"][index % 4];
            const image = aiSitePlaceholderImage(640, 520, "f6f8fb", productImageColor[index % productImageColor.length], category);
            const images = [
                image,
                aiSitePlaceholderImage(640, 520, "eef4ff", productImageColor[(index + 1) % productImageColor.length], `${category} Detail`),
                aiSitePlaceholderImage(640, 520, "f8fafc", productImageColor[(index + 2) % productImageColor.length], `${category} Application`)
            ];
            return {
                title,
                desc,
                category,
                image,
                images,
                sku: `GJ-${String(index + 1).padStart(3, "0")}`,
                material,
                application,
                lead_time: "15-35 days after drawing or sample confirmation",
                export_docs: "Commercial invoice, packing list, certificate, inspection record",
                content: `<h2>${htmlEscape(title)} Overview</h2>
<p>${htmlEscape(desc)}</p>
<h3>Typical Specifications</h3>
<table><tbody>
<tr><th>Category</th><td>${htmlEscape(category)}</td></tr>
<tr><th>Material</th><td>${htmlEscape(material)}</td></tr>
<tr><th>Application</th><td>${htmlEscape(application)}</td></tr>
<tr><th>Lead Time</th><td>15-35 days after drawing or sample confirmation</td></tr>
<tr><th>Export Documents</th><td>Commercial invoice, packing list, certificate, inspection record</td></tr>
</tbody></table>
<h3>Inquiry Checklist</h3>
<ul><li>Drawing, sample photo, or target model</li><li>Quantity and delivery market</li><li>Material, surface treatment, and tolerance requirements</li></ul>`
            };
        });
        const caseCategories = ["Factory Upgrade", "Distributor Program", "OEM Supply", "Process Optimization"];
        const newsCategories = ["Selection Guides", "Maintenance", "Materials", "Export Notes"];
        return {
            product: {
                label: "Products",
                taxonomy: "Product Categories",
                items: makeProductItems(Math.max(8, productCategories.length * 3))
            },
            service: {
                label: "Services",
                taxonomy: "Service Categories",
                items: [
                    { title: "Application Matching", desc: "Match products to operating conditions, buyer requirements, and target markets.", category: "Pre-sales", image: aiSitePlaceholderImage(800, 550, "eef4ff", "244aa5", "Application Matching"), images: [aiSitePlaceholderImage(800, 550, "eef4ff", "244aa5", "Application Matching"), aiSitePlaceholderImage(800, 550, "f8fafc", "1f57b7", "Selection Notes")], deliverables: "Selection notes, model shortlist, inquiry checklist", content: "<h2>Application Matching</h2><p>We translate buyer requirements into product selections, technical questions, and a sourcing path that can be confirmed quickly.</p><ul><li>Operating condition review</li><li>Model and material shortlist</li><li>RFQ checklist for faster quotation</li></ul>" },
                    { title: "Export Documentation", desc: "Support datasheets, certificates, packing details, and shipment documents.", category: "Export", image: aiSitePlaceholderImage(800, 550, "f4f7fb", "315f9f", "Export Documentation"), images: [aiSitePlaceholderImage(800, 550, "f4f7fb", "315f9f", "Export Documentation"), aiSitePlaceholderImage(800, 550, "eef4ff", "244aa5", "Packing Details")], deliverables: "Datasheets, certificates, packing list, shipment notes", content: "<h2>Export Documentation</h2><p>Documentation is prepared around foreign trade expectations so procurement, customs, and buyer approval steps move with fewer avoidable delays.</p><ul><li>Datasheet and certificate preparation</li><li>Packing and label information</li><li>Shipment document coordination</li></ul>" },
                    { title: "Distributor Support", desc: "Prepare catalogs, technical content, and inquiry follow-up materials for channel partners.", category: "Channel", image: aiSitePlaceholderImage(800, 550, "eef2f7", "2f6fc6", "Distributor Support"), images: [aiSitePlaceholderImage(800, 550, "eef2f7", "2f6fc6", "Distributor Support"), aiSitePlaceholderImage(800, 550, "f8fafc", "315f9f", "Catalog Planning")], deliverables: "Catalog structure, product copy, inquiry follow-up scripts", content: "<h2>Distributor Support</h2><p>Channel partners receive structured product information, localized selling points, and practical follow-up materials for repeated inquiry handling.</p><ul><li>Catalog and category planning</li><li>Sales copy and FAQ support</li><li>Repeat inquiry workflow</li></ul>" },
                    { title: "After-sales Coordination", desc: "Keep repeat orders, revisions, replenishment, and warranty communication organized.", category: "Support", image: aiSitePlaceholderImage(800, 550, "f6f8fb", "113a7c", "After Sales Support"), images: [aiSitePlaceholderImage(800, 550, "f6f8fb", "113a7c", "After Sales Support"), aiSitePlaceholderImage(800, 550, "eef4ff", "4878d0", "Revision Records")], deliverables: "Revision record, replenishment plan, after-sales communication log", content: "<h2>After-sales Coordination</h2><p>After the first order, we keep replacement, revision, and replenishment communication organized so buyers can reorder with confidence.</p><ul><li>Revision and reorder tracking</li><li>Warranty communication support</li><li>Repeat shipment coordination</li></ul>" }
                ]
            },
            case: {
                label: "Cases",
                taxonomy: "Case Categories",
                items: Array.from({ length: Math.max(4, productCategories.length) }, (_, index) => {
                    const category = productCategories[index % productCategories.length] || "Industrial Products";
                    const title = `${category} Export Project ${index + 1}`;
                    const desc = `${brand} delivered ${category.toLowerCase()} support for an overseas industrial customer, combining technical review, stable quality checks, and responsive export communication.`;
                    const region = ["Europe", "Middle East", "South America", "Southeast Asia"][index % 4];
                    const image = aiSitePlaceholderImage(800, 600, "eef4ff", productImageColor[index % productImageColor.length], `${category} Case`);
                    return {
                        title,
                        desc,
                        category: caseCategories[index % caseCategories.length],
                        image,
                        images: [
                            image,
                            aiSitePlaceholderImage(800, 600, "f8fafc", productImageColor[(index + 1) % productImageColor.length], `${category} Site Detail`),
                            aiSitePlaceholderImage(800, 600, "eef2f7", productImageColor[(index + 2) % productImageColor.length], `${region} Delivery`)
                        ],
                        region,
                        challenge: "The buyer needed clearer technical confirmation, predictable documents, and a faster quotation path.",
                        solution: `${brand} organized the inquiry details, checked product requirements, and prepared export-ready communication for ${primaryMarket}.`,
                        result: "The project moved from inquiry to confirmed specification with fewer repeated questions and a cleaner handoff.",
                        content: `<h2>Project Background</h2><p>${htmlEscape(desc)}</p><h3>Challenge</h3><p>The buyer needed clearer technical confirmation, predictable documents, and a faster quotation path.</p><h3>Solution</h3><p>${htmlEscape(brand)} organized the inquiry details, checked product requirements, and prepared export-ready communication for ${htmlEscape(primaryMarket)}.</p><h3>Result</h3><p>The project moved from inquiry to confirmed specification with fewer repeated questions and a cleaner handoff.</p>`
                    };
                })
            },
            news: {
                label: "News",
                taxonomy: "News Categories",
                items: Array.from({ length: Math.max(8, productCategories.length * 2) }, (_, index) => {
                    const category = productCategories[index % productCategories.length] || "Industrial Products";
                    const firstBlogTitle = /s$/i.test(category) ? `What Buyers Should Know About ${category}` : `What Is a ${category} and How Does It Work?`;
                    const blogTitles = [
                        firstBlogTitle,
                        `${category} Selection Guide for Industrial Piping Projects`,
                        `Resilient Seated vs Metal Seated ${category}: Key Differences`,
                        `${category} Maintenance Checklist for Export Buyers`,
                        `How to Prepare an RFQ for ${category} Suppliers`,
                        `${category} Materials, Pressure Ratings, and Inspection Notes`,
                        `Common ${category} Applications in Fluid Control Systems`,
                        `How Packaging and Documentation Affect ${category} Delivery`
                    ];
                    const title = blogTitles[index % blogTitles.length];
                    const desc = `Practical notes for sourcing ${category.toLowerCase()} in international industrial procurement, covering selection logic, documentation, inspection, and inquiry preparation.`;
                    const image = aiSitePlaceholderImage(640, 360, "e9edf4", "244aa5", category);
                    return {
                        title,
                        desc,
                        category: newsCategories[index % newsCategories.length],
                        image,
                        images: [
                            image,
                            aiSitePlaceholderImage(640, 360, "f4f7fb", "1f57b7", `${category} Guide`),
                            aiSitePlaceholderImage(640, 360, "eef4ff", "315f9f", `${category} Notes`)
                        ],
                        date: new Date(Date.now() - index * 3 * 86400000).toISOString().slice(0, 10),
                        content: `<h2>${htmlEscape(title)}</h2><p>${htmlEscape(desc)}</p><h3>What buyers should confirm first</h3><ul><li>Operating environment and technical standard</li><li>Quantity, packaging, and delivery market</li><li>Inspection, certificate, and documentation needs</li></ul><h3>How ${htmlEscape(brand)} supports the inquiry</h3><p>We turn early inquiry information into a clearer RFQ path so technical review, quotation, and export coordination can happen faster.</p>`
                    };
                })
            }
        };
    }
    function buildAiSiteWpSiteOptions(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        return {
            site_name: project.siteName,
            company: schema.company_profile,
            contact: schema.contact_info,
            social_links: schema.social_links,
            style_requirements: schema.style_requirements
        };
    }
    function buildAiSiteWpRouteBlueprint(project) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const categories = sectionArray(schema.business_taxonomy.product_categories);
        return {
            version: "1.0",
            mode: "multi-route-block-theme",
            note: "Static pages are assembled from ACF blocks. List/detail routes are backed by native WordPress CPT data seeded from collections.json.",
            nav: [
                { label: "Home", route_type: "page", slug: "home", source: "pages.home" },
                { label: "Products", route_type: "archive", post_type: "product", slug: "products", source: "collections.product" },
                { label: "Applications", route_type: "page", slug: "applications", source: "pages.applications" },
                { label: "About Us", route_type: "page", slug: "about-us", source: "pages.about_us" },
                { label: "Blog", route_type: "archive", post_type: "news", slug: "blog", source: "collections.news" },
                { label: "Contact Us", route_type: "page", slug: "contact-us", source: "pages.contact_us" }
            ],
            cpt_routes: {
                product: {
                    archive: "/products/",
                    taxonomy: "/product-category/{term}/",
                    single: "/products/{post}/",
                    data_source: "collections.product",
                    required_templates: ["archive-product.html", "taxonomy-product_cat.html", "single-product.html"],
                    seed_count: Math.max(8, categories.length * 3)
                },
                case: {
                    archive: "/cases/",
                    taxonomy: "/case-category/{term}/",
                    single: "/cases/{post}/",
                    data_source: "collections.case",
                    required_templates: ["archive-case.html", "taxonomy-case_cat.html", "single-case.html"],
                    seed_count: Math.max(4, categories.length)
                },
                news: {
                    archive: "/blog/",
                    taxonomy: "/news-category/{term}/",
                    single: "/blog/{post}/",
                    data_source: "collections.news",
                    required_templates: ["archive-news.html", "taxonomy-news_cat.html", "single-news.html"],
                    seed_count: Math.max(6, categories.length * 2)
                },
                service: {
                    archive: "/services/",
                    taxonomy: "/service-category/{term}/",
                    single: "/services/{post}/",
                    data_source: "collections.service",
                    required_templates: ["archive-service.html", "taxonomy-service_cat.html", "single-service.html"],
                    seed_count: 4
                }
            },
            static_pages: {
                home: ["hero", "products", "applications", "about_us", "blog", "contact_us"],
                applications: ["applications", "products", "contact_us"],
                about_us: ["about_us", "applications", "contact_us"],
                contact_us: ["contact_us"],
                thanks: ["contact_us"]
            }
        };
    }
    function buildAiSiteWpTemplateShell(content) {
        return `<!-- wp:template-part {"slug":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group">
${content}
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer"} /-->`;
    }
    function buildAiSiteWpArchiveTemplate(config) {
        const toneClass = `goodjob-archive--${config.tone}`;
        return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-archive ${toneClass}","layout":{"type":"constrained","contentSize":"1440px"}} -->
<section class="wp-block-group goodjob-archive ${toneClass}">
  <!-- wp:group {"className":"goodjob-archive__head","layout":{"type":"constrained","contentSize":"920px"}} -->
  <div class="wp-block-group goodjob-archive__head">
    <!-- wp:query-title {"type":"archive","level":1} /-->
    <!-- wp:paragraph --><p>${htmlEscape(config.intro)}</p><!-- /wp:paragraph -->
  </div>
  <!-- /wp:group -->
  <!-- wp:query {"query":{"perPage":12,"pages":0,"offset":0,"postType":"${config.cpt}","order":"desc","orderBy":"date","inherit":true},"displayLayout":{"type":"flex","columns":3},"className":"goodjob-archive__query"} -->
  <div class="wp-block-query goodjob-archive__query">
    <!-- wp:post-template className="goodjob-archive__grid" -->
      <!-- wp:group {"className":"goodjob-card","layout":{"type":"constrained"}} -->
      <article class="wp-block-group goodjob-card">
        <!-- wp:post-featured-image {"isLink":true,"aspectRatio":"${config.mediaRatio}","className":"goodjob-card__media"} /-->
        <!-- wp:post-terms {"term":"${config.cpt === "product" ? "product_cat" : config.cpt === "case" ? "case_cat" : config.cpt === "news" ? "news_cat" : config.cpt === "service" ? "service_cat" : "category"}","className":"goodjob-card__terms"} /-->
        <!-- wp:post-title {"isLink":true,"level":2,"className":"goodjob-card__title"} /-->
        <!-- wp:post-excerpt {"moreText":"View Details","className":"goodjob-card__excerpt"} /-->
      </article>
      <!-- /wp:group -->
    <!-- /wp:post-template -->
    <!-- wp:query-pagination {"className":"goodjob-pagination","layout":{"type":"flex","justifyContent":"center"}} -->
      <!-- wp:query-pagination-previous /-->
      <!-- wp:query-pagination-numbers /-->
      <!-- wp:query-pagination-next /-->
    <!-- /wp:query-pagination -->
    <!-- wp:query-no-results -->
      <!-- wp:paragraph --><p>No items have been published yet. Add content in the WordPress admin panel to populate this route.</p><!-- /wp:paragraph -->
    <!-- /wp:query-no-results -->
  </div>
  <!-- /wp:query -->
</section>
<!-- /wp:group -->`);
    }
    function buildAiSiteWpProductsArchiveTemplate() {
        return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/products-archive /-->`);
    }
    function buildAiSiteWpBlogArchiveTemplate() {
        return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/blog-archive /-->`);
    }
    function buildAiSiteWpNativeArchiveBlockJson(name, title, icon) {
        return {
            apiVersion: 2,
            name: `goodjob-ai-site/${name}`,
            title,
            category: "goodjob-ai-site",
            icon,
            description: `${title} dynamic CPT archive block generated by GoodJob AI Website Factory.`,
            render: "file:./render.php",
            style: "file:./style.css",
            supports: {
                html: false,
                align: ["wide", "full"]
            }
        };
    }
    function buildAiSiteWpProductsArchiveRender() {
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('product_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$query_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 12,
    'orderby' => 'menu_order date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$products = new WP_Query($query_args);
?>
<section class="goodjob-products-page">
  <div class="goodjob-products-page__wrap">
    <aside class="goodjob-products-sidebar" aria-label="Product categories">
      <h1>Products Categories</h1>
      <nav>
        <a class="<?php echo $current_term_id ? '' : 'is-active'; ?>" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">All Products</a>
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a class="<?php echo ((int) $term->term_id === $current_term_id) ? 'is-active' : ''; ?>" href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </nav>
    </aside>
    <div class="goodjob-products-main">
      <div class="goodjob-products-main__head">
        <span>Product Center</span>
        <h2><?php echo esc_html($current_term_id && $current_term ? $current_term->name : 'Industrial Product Catalog'); ?></h2>
        <p>Browse product categories, compare typical models, and open a direct inquiry for drawings, pricing, and export documents.</p>
      </div>
      <?php if ($products->have_posts()) : ?>
        <div class="goodjob-product-grid">
          <?php while ($products->have_posts()) : $products->the_post();
            $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
            if (!$image_url) {
                $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$image_url) {
                $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="goodjob-product-card">
              <a class="goodjob-product-card__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
                <span aria-hidden="true">→</span>
              </a>
              <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
        </div>
      <?php else : ?>
        <p class="goodjob-products-empty">No products are published yet. Add Products in the WordPress admin panel.</p>
      <?php endif; ?>
    </div>
  </div>
</section>`;
    }
    function buildAiSiteWpBlogArchiveRender() {
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('news_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$query_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 10,
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$news_query = new WP_Query($query_args);
?>
<section class="goodjob-blog-page">
  <header class="goodjob-blog-hero">
    <div class="goodjob-blog-hero__shade"></div>
    <h1><?php echo is_tax('news_cat') ? esc_html(single_term_title('', false)) : 'Blog'; ?></h1>
  </header>
  <nav class="goodjob-blog-breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">›</span>
    <span>Blog</span>
  </nav>
  <div class="goodjob-blog-list">
    <?php if ($news_query->have_posts()) : ?>
      <?php while ($news_query->have_posts()) : $news_query->the_post();
        $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
        if (!$image_url) {
            $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$image_url) {
            $image_url = 'https://placehold.co/640x360/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article class="goodjob-blog-item">
          <a class="goodjob-blog-item__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="goodjob-blog-item__body">
            <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
            <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
            <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 26)); ?></p>
            <a class="goodjob-blog-item__button" href="<?php the_permalink(); ?>">View Detail</a>
          </div>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    <?php else : ?>
      <p class="goodjob-blog-empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p>
    <?php endif; ?>
  </div>
</section>`;
    }
    function buildAiSiteWpProductsArchiveStyle() {
        return `.goodjob-products-page{background:#fff;padding:clamp(54px,6vw,92px) clamp(18px,4vw,54px)}
.goodjob-products-page__wrap{width:min(1440px,100%);margin:auto;display:grid;grid-template-columns:292px minmax(0,1fr);gap:clamp(34px,5vw,68px);align-items:start}
.goodjob-products-sidebar{background:#f0f0f0;padding:0 12px 12px;position:sticky;top:110px}
.goodjob-products-sidebar h1{margin:0 -12px 10px;padding:16px 16px;background:var(--blue,#244aa5);color:#fff;text-transform:uppercase;font-size:21px;line-height:1.15;letter-spacing:.01em}
.goodjob-products-sidebar nav{display:grid;background:#fff}
.goodjob-products-sidebar a{display:block;padding:16px 26px;border-bottom:1px solid #e7e7e7;color:#111827;text-decoration:none;font-size:18px;line-height:1.35}
.goodjob-products-sidebar a:hover,.goodjob-products-sidebar a.is-active{color:var(--blue,#244aa5);background:#f7f9ff}
.goodjob-products-main__head{margin-bottom:clamp(22px,3vw,34px)}
.goodjob-products-main__head span{display:inline-flex;margin-bottom:8px;color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;letter-spacing:.1em;font-size:12px}
.goodjob-products-main__head h2{margin:0 0 10px;color:#101828;font-size:clamp(30px,3.4vw,48px);line-height:1.08}
.goodjob-products-main__head p{margin:0;max-width:820px;color:#667085;font-size:16px;line-height:1.7}
.goodjob-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.goodjob-product-card{position:relative;background:#fff;border:1px solid #d3d3d3;min-width:0;text-align:center}
.goodjob-product-card__media{position:relative;display:block;aspect-ratio:1/1;background:#f7f8fa;overflow:hidden}
.goodjob-product-card__media img{width:100%;height:100%;object-fit:contain;display:block;transition:transform .35s ease}
.goodjob-product-card__media span{position:absolute;right:18px;top:22%;width:68px;height:68px;border-radius:50%;background:var(--blue,#244aa5);color:#fff;display:grid;place-items:center;font-size:38px;box-shadow:0 0 0 8px rgba(255,255,255,.88);opacity:0;transform:translateX(10px);transition:.25s ease}
.goodjob-product-card:hover .goodjob-product-card__media img{transform:scale(1.035)}
.goodjob-product-card:hover .goodjob-product-card__media span{opacity:1;transform:none}
.goodjob-product-card h3{min-height:82px;margin:0;padding:18px 18px 20px;display:grid;place-items:center;font-size:20px;line-height:1.12;font-weight:500}
.goodjob-product-card h3 a{color:#050b18;text-decoration:none}
.goodjob-products-empty{padding:28px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
@media(max-width:1100px){.goodjob-products-page__wrap{grid-template-columns:240px minmax(0,1fr)}.goodjob-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.goodjob-products-page{padding:36px 16px}.goodjob-products-page__wrap{grid-template-columns:1fr}.goodjob-products-sidebar{position:static}.goodjob-product-grid{grid-template-columns:1fr}.goodjob-product-card__media span{opacity:1;transform:none;width:54px;height:54px;font-size:30px}}`;
    }
    function buildAiSiteWpBlogArchiveStyle() {
        return `.goodjob-blog-page{background:#fff;color:#101828}
.goodjob-blog-hero{position:relative;min-height:255px;display:grid;place-items:start center;padding-top:8px;background:linear-gradient(rgba(0,0,0,.52),rgba(0,0,0,.52)),url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80") center 42%/cover no-repeat;color:#fff}
.goodjob-blog-hero h1{position:relative;margin:0;font-size:38px;line-height:1.1;color:#fff;font-weight:800}
.goodjob-blog-breadcrumb{background:#f0f0f0;min-height:72px;display:flex;align-items:center;gap:14px;padding:0 max(24px,calc((100vw - 1570px)/2 + 24px));font-size:19px}
.goodjob-blog-breadcrumb a{color:#111827;text-decoration:none}.goodjob-blog-breadcrumb span:last-child{color:var(--blue,#244aa5);text-transform:capitalize}
.goodjob-blog-list{width:min(1550px,calc(100vw - clamp(32px,8vw,180px)));margin:0 auto;padding:clamp(56px,7vw,78px) 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:62px;row-gap:54px}
.goodjob-blog-item{display:grid;grid-template-columns:minmax(180px,245px) minmax(0,1fr);gap:24px;padding-bottom:28px;border-bottom:1px solid #e7e7e7;align-items:start}
.goodjob-blog-item__media{display:block;border:1px solid #ddd;background:#f6f7f9;padding:6px;aspect-ratio:2/1;overflow:hidden}
.goodjob-blog-item__media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.goodjob-blog-item:hover .goodjob-blog-item__media img{transform:scale(1.04)}
.goodjob-blog-item__body{min-width:0}.goodjob-blog-item h2{margin:0 0 14px;font-size:24px;line-height:1.16;color:var(--blue,#244aa5)}
.goodjob-blog-item h2 a{color:inherit;text-decoration:none}.goodjob-blog-item time{display:block;margin-bottom:18px;color:#9aa0a6;font-size:18px}
.goodjob-blog-item time::before{content:"▣";font-size:14px;margin-right:6px;color:#a7adb4}.goodjob-blog-item p{margin:0;color:#050b18;font-size:18px;line-height:1.55}
.goodjob-blog-item__button{float:right;margin-top:18px;display:inline-flex;align-items:center;justify-content:center;min-width:140px;min-height:38px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-size:16px}
.goodjob-blog-empty{grid-column:1/-1;padding:28px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
@media(max-width:1180px){.goodjob-blog-list{grid-template-columns:1fr;width:min(100% - 48px,860px)}}
@media(max-width:640px){.goodjob-blog-hero{min-height:190px}.goodjob-blog-breadcrumb{min-height:60px;font-size:16px;padding:0 20px}.goodjob-blog-list{width:min(100% - 32px,680px);padding:40px 0}.goodjob-blog-item{grid-template-columns:1fr}.goodjob-blog-item__button{float:none;width:100%}}`;
    }
    function buildAiSiteWpProductDetailTemplate() {
        return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/product-detail /-->`);
    }
    function buildAiSiteWpNewsDetailTemplate() {
        return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/news-detail /-->`);
    }
    function buildAiSiteWpProductDetailRender() {
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'product_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/900x720/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$sku = (string) get_post_meta($post_id, 'goodjob_sku', true);
$material = (string) get_post_meta($post_id, 'goodjob_material', true);
$application = (string) get_post_meta($post_id, 'goodjob_application', true);
$lead_time = (string) get_post_meta($post_id, 'goodjob_lead_time', true);
$export_docs = (string) get_post_meta($post_id, 'goodjob_export_docs', true);
$specs = array(
    'SKU' => $sku ?: 'Confirm by drawing or sample',
    'Category' => $primary_term ? $primary_term->name : 'Industrial Product',
    'Material' => $material ?: 'Custom material available',
    'Application' => $application ?: 'Industrial fluid control and OEM supply',
    'Lead Time' => $lead_time ?: '15-35 days after confirmation',
    'Export Documents' => $export_docs ?: 'Invoice, packing list, certificate, inspection record',
);
$related_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-product-detail">
  <nav class="goodjob-product-detail__breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">/</span>
    <a href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Products</a>
    <span aria-hidden="true">/</span>
    <span><?php the_title(); ?></span>
  </nav>
  <section class="goodjob-product-detail__hero">
    <div class="goodjob-product-detail__media">
      <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
    </div>
    <div class="goodjob-product-detail__summary">
      <div class="goodjob-product-detail__terms">
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 34)); ?></p>
      <div class="goodjob-product-detail__actions">
        <a class="goodjob-product-detail__primary" href="<?php echo esc_url(home_url('/contact-us/')); ?>">Request Price & Drawings</a>
        <a class="goodjob-product-detail__ghost" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Back to Products</a>
      </div>
    </div>
  </section>
  <section class="goodjob-product-detail__body">
    <aside class="goodjob-product-detail__specs">
      <h2>Product Specifications</h2>
      <dl>
        <?php foreach ($specs as $label => $value) : ?>
          <div><dt><?php echo esc_html($label); ?></dt><dd><?php echo esc_html($value); ?></dd></div>
        <?php endforeach; ?>
      </dl>
      <div class="goodjob-product-detail__rfq">
        <strong>RFQ Checklist</strong>
        <ul>
          <li>Target model, drawing, or sample photo</li>
          <li>Quantity and destination market</li>
          <li>Material, pressure, size, and inspection needs</li>
        </ul>
      </div>
    </aside>
    <div class="goodjob-product-detail__content">
      <?php the_content(); ?>
    </div>
  </section>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-product-detail__related">
    <div class="goodjob-product-detail__related-head">
      <span>Related Products</span>
      <h2>More options in this category</h2>
    </div>
    <div class="goodjob-product-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post();
        $related_image = get_the_post_thumbnail_url(get_the_ID(), 'medium');
        if (!$related_image) {
            $related_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$related_image) {
            $related_image = 'https://placehold.co/420x320/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article>
          <a href="<?php the_permalink(); ?>"><img src="<?php echo esc_url($related_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async"></a>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>`;
    }
    function buildAiSiteWpProductDetailStyle() {
        return `.goodjob-product-detail{background:#fff;color:#101828}
.goodjob-product-detail__breadcrumb{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;padding:24px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:#667085;font-size:14px}
.goodjob-product-detail__breadcrumb a{color:var(--blue,#244aa5);text-decoration:none}
.goodjob-product-detail__hero{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;display:grid;grid-template-columns:minmax(360px,.9fr) minmax(0,1fr);gap:clamp(34px,5vw,76px);align-items:center;padding:clamp(18px,3vw,38px) 0 clamp(54px,7vw,92px)}
.goodjob-product-detail__media{background:#f4f7fb;border:1px solid #d9e1ec;aspect-ratio:1/1;display:grid;place-items:center;padding:clamp(18px,3vw,42px)}
.goodjob-product-detail__media img{width:100%;height:100%;object-fit:contain;display:block}
.goodjob-product-detail__terms{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}
.goodjob-product-detail__terms a{background:#eef4ff;color:var(--blue,#244aa5);border:1px solid #cdddf8;padding:7px 10px;font-size:12px;text-transform:uppercase;font-weight:900;text-decoration:none}
.goodjob-product-detail__summary h1{margin:0 0 18px;color:#050b18;font-size:clamp(38px,5vw,68px);line-height:1.02;letter-spacing:0}
.goodjob-product-detail__summary p{margin:0;color:#536273;font-size:clamp(16px,1.3vw,19px);line-height:1.75;max-width:720px}
.goodjob-product-detail__actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
.goodjob-product-detail__primary,.goodjob-product-detail__ghost{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;text-decoration:none;font-weight:900}
.goodjob-product-detail__primary{background:var(--blue,#244aa5);color:#fff}.goodjob-product-detail__ghost{background:#fff;color:#101828;border:1px solid #cfd8e6}
.goodjob-product-detail__body{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;display:grid;grid-template-columns:360px minmax(0,1fr);gap:clamp(30px,5vw,72px);align-items:start;padding:0 0 clamp(64px,8vw,108px)}
.goodjob-product-detail__specs{background:#f6f8fb;border-top:5px solid var(--blue,#244aa5);padding:clamp(22px,3vw,34px);position:sticky;top:112px}
.goodjob-product-detail__specs h2{margin:0 0 20px;font-size:24px;color:#101828}
.goodjob-product-detail__specs dl{margin:0;display:grid;gap:0}.goodjob-product-detail__specs div{border-bottom:1px solid #dce4ee;padding:13px 0}
.goodjob-product-detail__specs dt{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#667085;font-weight:900}.goodjob-product-detail__specs dd{margin:5px 0 0;color:#101828;line-height:1.45}
.goodjob-product-detail__rfq{margin-top:24px;background:#fff;border:1px solid #dde5ef;padding:18px}.goodjob-product-detail__rfq strong{display:block;margin-bottom:10px}.goodjob-product-detail__rfq ul{margin:0;padding-left:18px;color:#536273;line-height:1.65}
.goodjob-product-detail__content{min-width:0;color:#263241;font-size:17px;line-height:1.78}.goodjob-product-detail__content h2,.goodjob-product-detail__content h3{color:#101828;line-height:1.18}.goodjob-product-detail__content table{width:100%;border-collapse:collapse;margin:22px 0}.goodjob-product-detail__content th,.goodjob-product-detail__content td{border:1px solid #dde5ef;padding:12px;text-align:left}
.goodjob-product-detail__related{background:#f6f8fb;padding:clamp(52px,7vw,86px) clamp(18px,4vw,54px)}.goodjob-product-detail__related-head,.goodjob-product-detail__related-grid{width:min(1440px,100%);margin:auto}.goodjob-product-detail__related-head span{color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.1em}.goodjob-product-detail__related-head h2{margin:8px 0 28px;font-size:clamp(28px,3.5vw,44px)}
.goodjob-product-detail__related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.goodjob-product-detail__related-grid article{background:#fff;border:1px solid #dce4ee;padding:16px}.goodjob-product-detail__related-grid img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#f4f7fb}.goodjob-product-detail__related-grid h3{font-size:18px;line-height:1.25}.goodjob-product-detail__related-grid a{color:#101828;text-decoration:none}
@media(max-width:980px){.goodjob-product-detail__hero,.goodjob-product-detail__body{grid-template-columns:1fr}.goodjob-product-detail__specs{position:static}.goodjob-product-detail__related-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.goodjob-product-detail__hero,.goodjob-product-detail__body,.goodjob-product-detail__breadcrumb{width:min(100% - 32px,680px)}.goodjob-product-detail__actions a{width:100%}.goodjob-product-detail__related-grid{grid-template-columns:1fr}}`;
    }
    function buildAiSiteWpNewsDetailRender() {
        return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'news_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/1200x640/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$related_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-news-detail">
  <header class="goodjob-news-detail__hero">
    <div class="goodjob-news-detail__shade"></div>
    <div class="goodjob-news-detail__hero-inner">
      <nav class="goodjob-news-detail__breadcrumb" aria-label="Breadcrumb">
        <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
        <span aria-hidden="true">/</span>
        <a href="<?php echo esc_url(get_post_type_archive_link('news')); ?>">Blog</a>
      </nav>
      <div class="goodjob-news-detail__meta">
        <?php if ($primary_term) : ?><span><?php echo esc_html($primary_term->name); ?></span><?php endif; ?>
        <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 28)); ?></p>
    </div>
  </header>
  <div class="goodjob-news-detail__layout">
    <main class="goodjob-news-detail__main">
      <figure class="goodjob-news-detail__image">
        <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
      </figure>
      <div class="goodjob-news-detail__content">
        <?php the_content(); ?>
      </div>
    </main>
    <aside class="goodjob-news-detail__aside">
      <div class="goodjob-news-detail__panel">
        <strong>Need help with product selection?</strong>
        <p>Send your operating conditions, target market, and expected quantity. We will prepare a focused RFQ path.</p>
        <a href="<?php echo esc_url(home_url('/contact-us/')); ?>">Send Inquiry</a>
      </div>
      <?php if (!empty($terms)) : ?>
      <div class="goodjob-news-detail__panel">
        <strong>Topics</strong>
        <div class="goodjob-news-detail__tags">
          <?php foreach ($terms as $term) :
            $term_link = get_term_link($term);
            if (is_wp_error($term_link)) {
                continue;
            }
          ?>
            <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>
    </aside>
  </div>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-news-detail__related">
    <div class="goodjob-news-detail__related-head">
      <span>More Blogs</span>
      <h2>Related reading</h2>
    </div>
    <div class="goodjob-news-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post(); ?>
        <article>
          <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
          <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 18)); ?></p>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>`;
    }
    function buildAiSiteWpNewsDetailStyle() {
        return `.goodjob-news-detail{background:#fff;color:#101828}
.goodjob-news-detail__hero{position:relative;min-height:430px;background:linear-gradient(rgba(6,16,32,.66),rgba(6,16,32,.66)),url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80") center/cover no-repeat;color:#fff;display:grid;align-items:end}
.goodjob-news-detail__hero-inner{position:relative;width:min(1120px,calc(100vw - clamp(32px,8vw,160px)));margin:0 auto;padding:54px 0}
.goodjob-news-detail__breadcrumb{display:flex;gap:10px;align-items:center;margin-bottom:22px;color:rgba(255,255,255,.76)}.goodjob-news-detail__breadcrumb a{color:#fff;text-decoration:none}
.goodjob-news-detail__meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}.goodjob-news-detail__meta span,.goodjob-news-detail__meta time{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);padding:7px 10px;font-size:12px;text-transform:uppercase;font-weight:900;letter-spacing:.08em}
.goodjob-news-detail__hero h1{max-width:920px;margin:0;color:#fff;font-size:clamp(38px,5vw,70px);line-height:1.04}.goodjob-news-detail__hero p{max-width:760px;margin:18px 0 0;color:rgba(255,255,255,.8);font-size:18px;line-height:1.65}
.goodjob-news-detail__layout{width:min(1320px,calc(100vw - clamp(32px,7vw,130px)));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:clamp(34px,5vw,72px);padding:clamp(54px,7vw,90px) 0}
.goodjob-news-detail__image{margin:0 0 34px;background:#f4f7fb;border:1px solid #dde5ef}.goodjob-news-detail__image img{width:100%;aspect-ratio:16/8;object-fit:cover;display:block}
.goodjob-news-detail__content{font-size:18px;line-height:1.82;color:#263241}.goodjob-news-detail__content h2,.goodjob-news-detail__content h3{color:#101828;line-height:1.18;margin-top:1.7em}.goodjob-news-detail__content ul{padding-left:1.3em}
.goodjob-news-detail__aside{display:grid;gap:20px;align-content:start;position:sticky;top:112px}.goodjob-news-detail__panel{background:#f6f8fb;border:1px solid #dde5ef;border-top:4px solid var(--blue,#244aa5);padding:22px}.goodjob-news-detail__panel strong{display:block;color:#101828;font-size:20px;line-height:1.2}.goodjob-news-detail__panel p{color:#536273;line-height:1.65}.goodjob-news-detail__panel>a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900;padding:0 16px}
.goodjob-news-detail__tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.goodjob-news-detail__tags a{background:#fff;color:var(--blue,#244aa5);border:1px solid #cdddf8;text-decoration:none;padding:7px 10px;font-weight:800}
.goodjob-news-detail__related{background:#f6f8fb;padding:clamp(52px,7vw,86px) clamp(18px,4vw,54px)}.goodjob-news-detail__related-head,.goodjob-news-detail__related-grid{width:min(1320px,100%);margin:auto}.goodjob-news-detail__related-head span{color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.1em}.goodjob-news-detail__related-head h2{margin:8px 0 28px;font-size:clamp(28px,3.5vw,44px)}
.goodjob-news-detail__related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.goodjob-news-detail__related-grid article{background:#fff;border:1px solid #dce4ee;padding:24px}.goodjob-news-detail__related-grid time{color:#98a2b3}.goodjob-news-detail__related-grid h3{font-size:20px;line-height:1.2}.goodjob-news-detail__related-grid a{color:var(--blue,#244aa5);text-decoration:none}.goodjob-news-detail__related-grid p{color:#536273;line-height:1.6}
@media(max-width:980px){.goodjob-news-detail__layout{grid-template-columns:1fr}.goodjob-news-detail__aside{position:static}.goodjob-news-detail__related-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.goodjob-news-detail__hero{min-height:360px}.goodjob-news-detail__hero-inner,.goodjob-news-detail__layout{width:min(100% - 32px,680px)}.goodjob-news-detail__related-grid{grid-template-columns:1fr}}`;
    }
    function buildAiSiteWpSingleTemplate(config) {
        const toneClass = `goodjob-single--${config.tone}`;
        return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-single ${toneClass}","layout":{"type":"constrained","contentSize":"1180px"}} -->
<article class="wp-block-group goodjob-single ${toneClass}">
  <!-- wp:post-terms {"term":"${config.cpt === "product" ? "product_cat" : config.cpt === "case" ? "case_cat" : config.cpt === "news" ? "news_cat" : config.cpt === "service" ? "service_cat" : "category"}","className":"goodjob-single__terms"} /-->
  <!-- wp:post-title {"level":1,"className":"goodjob-single__title"} /-->
  <!-- wp:post-featured-image {"aspectRatio":"16/9","className":"goodjob-single__media"} /-->
  <!-- wp:post-content {"layout":{"type":"constrained","contentSize":"860px"},"className":"goodjob-single__content"} /-->
  <!-- wp:group {"className":"goodjob-single__cta","layout":{"type":"flex","justifyContent":"space-between","flexWrap":"wrap"}} -->
  <div class="wp-block-group goodjob-single__cta">
    <!-- wp:paragraph --><p>${htmlEscape(config.cta)}</p><!-- /wp:paragraph -->
    <!-- wp:buttons -->
    <div class="wp-block-buttons"><!-- wp:button {"className":"is-style-fill"} --><div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button" href="/contact-us/">Send Inquiry</a></div><!-- /wp:button --></div>
    <!-- /wp:buttons -->
  </div>
  <!-- /wp:group -->
</article>
<!-- /wp:group -->`);
    }
    function buildAiSiteWpSearchTemplate() {
        return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-archive goodjob-archive--search","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group goodjob-archive goodjob-archive--search">
  <!-- wp:query-title {"type":"search","level":1} /-->
  <!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search","className":"goodjob-search-form"} /-->
  <!-- wp:query {"query":{"perPage":10,"pages":0,"offset":0,"postType":"any","order":"desc","orderBy":"date","inherit":true}} -->
  <div class="wp-block-query">
    <!-- wp:post-template className="goodjob-archive__grid" -->
      <!-- wp:group {"className":"goodjob-card","layout":{"type":"constrained"}} -->
      <article class="wp-block-group goodjob-card">
        <!-- wp:post-title {"isLink":true,"level":2,"className":"goodjob-card__title"} /-->
        <!-- wp:post-excerpt {"moreText":"Read More"} /-->
      </article>
      <!-- /wp:group -->
    <!-- /wp:post-template -->
    <!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"center"}} -->
      <!-- wp:query-pagination-previous /-->
      <!-- wp:query-pagination-numbers /-->
      <!-- wp:query-pagination-next /-->
    <!-- /wp:query-pagination -->
  </div>
  <!-- /wp:query -->
</section>
<!-- /wp:group -->`);
    }
    function buildAiSiteWp404Template() {
        return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-not-found","layout":{"type":"constrained","contentSize":"760px"}} -->
<section class="wp-block-group goodjob-not-found">
  <!-- wp:heading {"level":1} --><h1>Page Not Found</h1><!-- /wp:heading -->
  <!-- wp:paragraph --><p>The page you are looking for may have moved. Search the site or return to the homepage.</p><!-- /wp:paragraph -->
  <!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search"} /-->
  <!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
  <div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/">Back to Home</a></div><!-- /wp:button --></div>
  <!-- /wp:buttons -->
</section>
<!-- /wp:group -->`);
    }
    function buildAiSiteWpRouteCss() {
        return `

/* Multi-route WordPress templates */
.goodjob-archive,.goodjob-single,.goodjob-not-found{padding:clamp(64px,8vw,116px) clamp(20px,4vw,56px)}
.goodjob-archive__head{margin-bottom:clamp(28px,4vw,56px);text-align:center}
.goodjob-archive__head h1,.goodjob-single__title,.goodjob-not-found h1{margin:0 0 16px;color:var(--ink,#16202e);font-size:clamp(36px,5vw,68px);line-height:1.04}
.goodjob-archive__head p,.goodjob-single__content,.goodjob-not-found p{color:var(--body,#3c4858);font-size:clamp(16px,1.2vw,18px);line-height:1.75}
.goodjob-archive__grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,2.4vw,30px)}
.goodjob-card{background:#fff;border:1px solid var(--line,#e2e7ee);box-shadow:0 18px 48px rgba(16,32,60,.08);overflow:hidden}
.goodjob-card__media{margin:0;background:#eef2f7}
.goodjob-card__terms{margin:18px 20px 6px;color:var(--red,#c8161c);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.goodjob-card__title{margin:0 20px 10px;font-size:clamp(20px,1.8vw,28px);line-height:1.16}
.goodjob-card__title a{color:var(--ink,#16202e);text-decoration:none}
.goodjob-card__excerpt{margin:0 20px 22px;color:var(--body,#3c4858);line-height:1.68}
.goodjob-archive--product{background:#f7f9fc}.goodjob-archive--case{background:#fff}.goodjob-archive--news{background:#f5f7fb}.goodjob-archive--service{background:#fff}
.goodjob-archive--case .goodjob-card{border-radius:0}.goodjob-archive--news .goodjob-card{box-shadow:none;border-left:4px solid var(--blue,#143a7b)}.goodjob-archive--service .goodjob-card{display:grid;grid-template-columns:190px minmax(0,1fr)}
.goodjob-single{background:#fff}
.goodjob-single__terms{color:var(--red,#c8161c);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.goodjob-single__media{margin:clamp(22px,4vw,42px) 0;background:#eef2f7}
.goodjob-single__content{max-width:860px;margin:0 auto}
.goodjob-single__cta{margin-top:clamp(30px,5vw,56px);padding:clamp(20px,3vw,34px);background:#f7f9fc;border:1px solid var(--line,#e2e7ee)}
.goodjob-pagination{margin-top:clamp(28px,4vw,48px)}
.goodjob-search-form{margin:0 auto 34px;max-width:720px}
.goodjob-not-found{text-align:center;min-height:54vh;display:grid;place-content:center}
@media(max-width:920px){.goodjob-archive__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.goodjob-archive--service .goodjob-card{display:block}}
@media(max-width:640px){.goodjob-archive__grid{grid-template-columns:1fr}.goodjob-archive,.goodjob-single,.goodjob-not-found{padding:48px 20px}}
`;
    }
    function aiSiteWpRebuildSummary(checks) {
        return checks.reduce((summary, check) => {
            summary[check.status] += 1;
            return summary;
        }, { pass: 0, warning: 0, error: 0 });
    }
    async function inspectAiSiteWpRebuild(project) {
        await ensureAiSiteSandbox(project);
        const order = await readAiSiteOrder(project);
        const customPages = await readAiSiteCustomPages(project);
        const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
        const sectionMap = new Map(wpMetadata.sections.map((section) => [section.section_key, section]));
        const checks = [];
        for (const sectionKey of order) {
            const section = sectionMap.get(sectionKey);
            const label = aiSiteSectionLabel(sectionKey, customPages);
            const file = aiSectionFile(project.id, sectionKey);
            if (!(await fileExists(file))) {
                checks.push({
                    key: sectionKey,
                    label,
                    status: aiSiteLockedSections.has(sectionKey) ? "warning" : "error",
                    message: aiSiteLockedSections.has(sectionKey) ? "Locked component will use the default fragment." : "HTML source file is missing.",
                    target: section?.wp_target
                });
                continue;
            }
            const html = await readFile(file, "utf8").catch(() => "");
            if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
                checks.push({ key: sectionKey, label, status: "error", message: "Fragment appears to contain CRM shell content.", target: section?.wp_target });
                continue;
            }
            if (!/<(section|header|footer|main|article)\b/i.test(html)) {
                checks.push({ key: sectionKey, label, status: "warning", message: "Fragment has no semantic wrapper; it can export but needs WP review.", target: section?.wp_target });
                continue;
            }
            checks.push({ key: sectionKey, label, status: "pass", message: "HTML source and WP metadata are ready.", target: section?.wp_target });
        }
        const root = aiBuildRoot();
        checks.push({
            key: "ai_build_root",
            label: "AI build storage",
            status: await fileExists(root) ? "pass" : "warning",
            message: `Project storage is resolved to ${root}.`,
            target: root
        });
        const routeBlueprint = buildAiSiteWpRouteBlueprint(project);
        const staticPageCount = Object.keys(routeBlueprint.static_pages).length;
        const cptRoutes = Object.entries(routeBlueprint.cpt_routes);
        checks.push({
            key: "wp_routes",
            label: "WordPress route blueprint",
            status: staticPageCount >= 4 && cptRoutes.length >= 4 ? "pass" : "warning",
            message: `Prepared ${staticPageCount} static pages and ${cptRoutes.length} CPT route groups for multi-route assembly.`,
            target: "theme/_data/routes.json"
        });
        const collections = buildAiSiteWpCollections(project);
        for (const [postType, collection] of Object.entries(collections)) {
            const items = Array.isArray(collection.items) ? collection.items : [];
            const routeConfig = routeBlueprint.cpt_routes[postType];
            const expected = routeConfig?.seed_count || (postType === "service" ? 4 : 1);
            const withContent = items.filter((item) => typeof item.content === "string" && item.content.trim().length > 40).length;
            checks.push({
                key: `wp_collection_${postType}`,
                label: `${collection.label} seed data`,
                status: items.length >= expected && withContent === items.length ? "pass" : items.length ? "warning" : "error",
                message: `Prepared ${items.length} ${postType} seed records; ${withContent} include editable detail content.`,
                target: `theme/_data/collections.json:${postType}`
            });
        }
        const requiredTemplates = [
            "front-page.html", "index.html", "archive-product.html", "taxonomy-product_cat.html", "single-product.html",
            "archive-case.html", "taxonomy-case_cat.html", "single-case.html", "archive-news.html", "taxonomy-news_cat.html",
            "single-news.html", "archive-service.html", "taxonomy-service_cat.html", "single-service.html", "archive.html",
            "single.html", "search.html", "404.html"
        ];
        checks.push({
            key: "wp_templates",
            label: "WordPress template set",
            status: "pass",
            message: `Export will create ${requiredTemplates.length} block templates covering home, archives, taxonomies, singles, search, and 404.`,
            target: "theme/templates"
        });
        return { project, order, customPages, wpMetadata, checks, summary: aiSiteWpRebuildSummary(checks) };
    }
    async function exportAiSiteWpRebuildPackage(project) {
        const state = await inspectAiSiteWpRebuild(project);
        const exportDir = aiSiteWpRebuildExportDir(project.id);
        const themeSlug = cleanAiSiteWpThemeSlug(project.siteName || project.taskName || project.id);
        const themeDir = path.join(exportDir, "theme");
        const sectionsDir = path.join(exportDir, "sections");
        const patternsDir = path.join(themeDir, "patterns");
        const partsDir = path.join(themeDir, "parts");
        const templatesDir = path.join(themeDir, "templates");
        const blocksDir = path.join(themeDir, "blocks");
        const acfJsonDir = path.join(themeDir, "acf-json");
        const dataDir = path.join(themeDir, "_data");
        const incDir = path.join(themeDir, "inc");
        const assetsJsDir = path.join(themeDir, "assets", "js");
        const exportedAt = new Date().toISOString();
        const files = [];
        await rm(exportDir, { recursive: true, force: true });
        await mkdir(sectionsDir, { recursive: true });
        await mkdir(patternsDir, { recursive: true });
        await mkdir(partsDir, { recursive: true });
        await mkdir(templatesDir, { recursive: true });
        await mkdir(blocksDir, { recursive: true });
        await mkdir(acfJsonDir, { recursive: true });
        await mkdir(dataDir, { recursive: true });
        await mkdir(incDir, { recursive: true });
        await mkdir(assetsJsDir, { recursive: true });
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const title = cleanAiSiteWpHeaderValue(schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName, "GoodJob AI Site");
        const description = cleanAiSiteWpHeaderValue(schema.company_profile.description || schema.company_profile.tagline, "Block theme starter exported from GoodJob AI Website Factory.");
        const pageBlockLines = [];
        const pageBlocksByKey = new Map();
        for (const section of state.wpMetadata.sections) {
            const raw = await readFile(aiSectionFile(project.id, section.section_key), "utf8").catch(() => defaultAiSectionHtml(section.section_key, project, false, state.customPages));
            const fragment = sanitizeAiSiteWpExportFragment(raw);
            const sourceName = `${section.section_key}.html`;
            await writeFile(path.join(sectionsDir, sourceName), fragment, "utf8");
            files.push(`sections/${sourceName}`);
            if (section.section_key === "header" || section.section_key === "footer") {
                const partName = `${section.section_key}.html`;
                const partFragment = section.section_key === "header" ? `${aiSiteIconSprite()}\n${fragment}` : fragment;
                await writeFile(path.join(partsDir, partName), partFragment, "utf8");
                files.push(`theme/parts/${partName}`);
                continue;
            }
            const patternSlug = cleanAiSiteWpThemeSlug(section.section_key, "section");
            const patternFile = `${patternSlug}.php`;
            const pattern = `<?php
/**
 * Title: ${section.label}
 * Slug: ${themeSlug}/${patternSlug}
 * Categories: goodjob-ai-site
 */
?>
${fragment}
`;
            await writeFile(path.join(patternsDir, patternFile), pattern, "utf8");
            files.push(`theme/patterns/${patternFile}`);
            const blockSlug = aiSiteWpBlockSlug(section.section_key);
            const blockDir = path.join(blocksDir, blockSlug);
            await mkdir(blockDir, { recursive: true });
            await writeFile(path.join(blockDir, "block.json"), JSON.stringify(buildAiSiteWpBlockJson(section), null, 2), "utf8");
            await writeFile(path.join(blockDir, "render.php"), buildAiSiteWpBlockRender(section, fragment), "utf8");
            await writeFile(path.join(blockDir, "style.css"), buildAiSiteWpBlockStyle(section), "utf8");
            await writeFile(path.join(acfJsonDir, `group_block_${blockSlug}.json`), JSON.stringify(buildAiSiteWpAcfFieldGroup(section, fragment), null, 2), "utf8");
            files.push(`theme/blocks/${blockSlug}/block.json`, `theme/blocks/${blockSlug}/render.php`, `theme/blocks/${blockSlug}/style.css`, `theme/acf-json/group_block_${blockSlug}.json`);
            const pageBlock = buildAiSiteWpPageBlock(section, fragment);
            pageBlockLines.push(pageBlock);
            pageBlocksByKey.set(section.section_key, pageBlock);
        }
        const styleCss = `/*
Theme Name: ${title}
Theme URI: https://goodjob.local/ai-site
Author: GoodJob AI Website Factory
Description: ${description}
Version: 0.1.0
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.0
Text Domain: ${themeSlug}
*/

${aiSiteFrameworkCss(project)}
${buildAiSiteWpRouteCss()}
`;
        const themeJson = {
            version: 3,
            settings: {
                appearanceTools: true,
                layout: { contentSize: "1180px", wideSize: "1440px" }
            },
            styles: {
                color: { background: "#ffffff", text: "#101828" },
                typography: { fontFamily: "Inter, Arial, sans-serif" }
            },
            templateParts: [
                { name: "header", title: "Header", area: "header" },
                { name: "footer", title: "Footer", area: "footer" }
            ]
        };
        const siteOptions = buildAiSiteWpSiteOptions(project);
        const collections = buildAiSiteWpCollections(project);
        const routeBlueprint = buildAiSiteWpRouteBlueprint(project);
        const pageContent = pageBlockLines.join("\n\n");
        const pageContentFor = (keys) => keys.map((key) => pageBlocksByKey.get(key)).filter(Boolean).join("\n\n");
        const frontPageTemplate = `<!-- wp:template-part {"slug":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group">
<!-- wp:post-content {"layout":{"type":"default"}} /-->
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer"} /-->`;
        const pages = {
            home: {
                title: "Home",
                slug: "home",
                template: "front-page",
                status: "publish",
                post_content: pageContent
            },
            applications: {
                title: "Applications",
                slug: "applications",
                template: "page",
                status: "publish",
                post_content: pageContentFor(["applications", "products", "contact_us"])
            },
            about_us: {
                title: "About Us",
                slug: "about-us",
                template: "page",
                status: "publish",
                post_content: pageContentFor(["about_us", "applications", "contact_us"])
            },
            contact_us: {
                title: "Contact Us",
                slug: "contact-us",
                template: "page",
                status: "publish",
                post_content: pageContentFor(["contact_us"])
            },
            thanks: {
                title: "Thank You",
                slug: "thanks",
                template: "page",
                status: "publish",
                post_content: `<!-- wp:group {"className":"goodjob-not-found","layout":{"type":"constrained","contentSize":"760px"}} -->
<section class="wp-block-group goodjob-not-found">
<!-- wp:heading {"level":1} --><h1>Thank You</h1><!-- /wp:heading -->
<!-- wp:paragraph --><p>Your inquiry has been received. Our team will review your project details and respond with the next step as soon as possible.</p><!-- /wp:paragraph -->
<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/">Back to Home</a></div><!-- /wp:button --></div><!-- /wp:buttons -->
</section>
<!-- /wp:group -->`
            }
        };
        const readme = `# ${title}

This is a WordPress ACF block theme package exported by GoodJob AI Website Factory.

- Review \`conversion-report.json\` before installation.
- Source fragments are stored in \`sections/\`.
- Editable ACF blocks are stored in \`theme/blocks/\`.
- ACF Local JSON field groups are stored in \`theme/acf-json/\`.
- Seed data and route blueprints are stored in \`theme/_data/\`.
- Activating the theme registers CPTs, ACF blocks, admin tools, static pages, route templates, and seed content once.
- Multi-route templates include products, cases, services, blog/news, taxonomy archives, single detail pages, search, and 404.
`;
        const cptPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_collection_types() {
    return array(
        'product' => array('label' => 'Products', 'singular' => 'Product', 'taxonomy' => 'product_cat', 'archive_slug' => 'products', 'taxonomy_slug' => 'product-category', 'icon' => 'dashicons-products'),
        'service' => array('label' => 'Services', 'singular' => 'Service', 'taxonomy' => 'service_cat', 'archive_slug' => 'services', 'taxonomy_slug' => 'service-category', 'icon' => 'dashicons-hammer'),
        'case' => array('label' => 'Cases', 'singular' => 'Case', 'taxonomy' => 'case_cat', 'archive_slug' => 'cases', 'taxonomy_slug' => 'case-category', 'icon' => 'dashicons-portfolio'),
        'news' => array('label' => 'News', 'singular' => 'News', 'taxonomy' => 'news_cat', 'archive_slug' => 'blog', 'taxonomy_slug' => 'news-category', 'icon' => 'dashicons-media-document'),
    );
}

function goodjob_ai_site_register_cpts() {
    foreach (goodjob_ai_site_collection_types() as $post_type => $config) {
        register_post_type($post_type, array(
            'labels' => array(
                'name' => $config['label'],
                'singular_name' => $config['singular'],
                'add_new_item' => 'Add New ' . $config['singular'],
                'edit_item' => 'Edit ' . $config['singular'],
            ),
            'public' => true,
            'show_in_rest' => true,
            'has_archive' => true,
            'menu_icon' => $config['icon'],
            'supports' => array('title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions'),
            'rewrite' => array('slug' => $config['archive_slug']),
        ));
        register_taxonomy($config['taxonomy'], array($post_type), array(
            'labels' => array('name' => $config['label'] . ' Categories'),
            'public' => true,
            'hierarchical' => true,
            'show_in_rest' => true,
            'rewrite' => array('slug' => $config['taxonomy_slug']),
        ));
    }
}
add_action('init', 'goodjob_ai_site_register_cpts');
`;
        const acfPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_acf_json_load_paths($paths) {
    $paths[] = get_stylesheet_directory() . '/acf-json';
    return $paths;
}
add_filter('acf/settings/load_json', 'goodjob_ai_site_acf_json_load_paths');

function goodjob_ai_site_register_acf_field_groups() {
    if (!function_exists('acf_add_local_field_group')) {
        return;
    }
    foreach (glob(get_stylesheet_directory() . '/acf-json/group_*.json') as $file) {
        $group = json_decode(file_get_contents($file), true);
        if (is_array($group) && !empty($group['key'])) {
            acf_add_local_field_group($group);
        }
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_field_groups', 5);

function goodjob_ai_site_block_categories($categories) {
    foreach ($categories as $category) {
        if (isset($category['slug']) && $category['slug'] === 'goodjob-ai-site') {
            return $categories;
        }
    }
    $categories[] = array(
        'slug' => 'goodjob-ai-site',
        'title' => 'GoodJob AI Site',
        'icon' => null,
    );
    return $categories;
}
add_filter('block_categories_all', 'goodjob_ai_site_block_categories', 10, 1);

function goodjob_ai_site_register_acf_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $dir = dirname($file);
        $metadata = json_decode(file_get_contents($file), true);
        if (!is_array($metadata) || empty($metadata['name'])) {
            continue;
        }
        $full_name = (string) $metadata['name'];
        if (strpos($full_name, 'acf/') !== 0) {
            continue;
        }
        $acf_name = preg_replace('#^acf/#', '', $full_name);
        if (!$acf_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        if (function_exists('acf_register_block_type')) {
            acf_register_block_type(array(
                'name' => $acf_name,
                'title' => $metadata['title'] ?? ucwords(str_replace('-', ' ', $acf_name)),
                'description' => $metadata['description'] ?? '',
                'category' => $metadata['category'] ?? 'goodjob-ai-site',
                'icon' => $metadata['icon'] ?? 'layout',
                'keywords' => $metadata['keywords'] ?? array('goodjob'),
                'mode' => $metadata['acf']['mode'] ?? 'preview',
                'render_template' => $dir . '/' . ($metadata['acf']['renderTemplate'] ?? 'render.php'),
                'supports' => $metadata['supports'] ?? array(),
            ));
            continue;
        }
        register_block_type($dir);
    }
}

function goodjob_ai_site_register_native_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $metadata = json_decode(file_get_contents($file), true);
        $full_name = is_array($metadata) && !empty($metadata['name']) ? (string) $metadata['name'] : '';
        if (!$full_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        register_block_type(dirname($file));
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_blocks', 20);
add_action('init', 'goodjob_ai_site_register_native_blocks', 30);

function goodjob_ai_site_enqueue_block_styles() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/style.css') as $file) {
        $slug = basename(dirname($file));
        wp_enqueue_style(
            'goodjob-ai-site-block-' . $slug,
            get_stylesheet_directory_uri() . '/blocks/' . $slug . '/style.css',
            array('goodjob-ai-site-style'),
            filemtime($file)
        );
    }
}
add_action('enqueue_block_assets', 'goodjob_ai_site_enqueue_block_styles');
`;
        const installerPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_read_json($relative) {
    $file = get_stylesheet_directory() . '/' . ltrim($relative, '/');
    if (!file_exists($file)) {
        return array();
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : array();
}

function goodjob_ai_site_data_signature() {
    $files = array('_data/pages.json', '_data/collections.json', '_data/site-options.json', '_data/routes.json');
    $hashes = array();
    foreach ($files as $relative) {
        $file = get_stylesheet_directory() . '/' . $relative;
        $hashes[] = file_exists($file) ? md5_file($file) : '';
    }
    return md5(implode('|', $hashes));
}

function goodjob_ai_site_is_legacy_generated_page_content($content) {
    $content = (string) $content;
    if ($content === '') {
        return false;
    }
    if (strpos($content, 'wp:template-part') !== false && strpos($content, 'wp:acf/') !== false) {
        return true;
    }
    if (strpos($content, 'wp:acf/') !== false && preg_match('/<!--\\s+wp:acf\\/[a-z0-9-]+\\s+[^>]*-->\\s*<(section|header|footer)\\b/i', $content)) {
        return true;
    }
    return false;
}

function goodjob_ai_site_seed_pages($force = false) {
    $pages = goodjob_ai_site_read_json('_data/pages.json');
    foreach ($pages as $page) {
        $slug = sanitize_title($page['slug'] ?? $page['title'] ?? 'home');
        $existing = get_page_by_path($slug);
        $existing_content = $existing ? trim((string) $existing->post_content) : '';
        $is_legacy_generated_shell = goodjob_ai_site_is_legacy_generated_page_content($existing_content);
        if ($existing && !$force && $existing_content !== '' && !$is_legacy_generated_shell) {
            continue;
        }
        $postarr = array(
            'post_title' => sanitize_text_field($page['title'] ?? 'Home'),
            'post_name' => $slug,
            'post_status' => sanitize_key($page['status'] ?? 'publish'),
            'post_type' => 'page',
            'post_content' => $page['post_content'] ?? '',
        );
        $page_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
        if (!is_wp_error($page_id) && $slug === 'home') {
            update_option('show_on_front', 'page');
            update_option('page_on_front', (int) $page_id);
        }
    }
}

function goodjob_ai_site_seed_collections($force = false) {
    $collections = goodjob_ai_site_read_json('_data/collections.json');
    foreach ($collections as $post_type => $collection) {
        if (!post_type_exists($post_type)) {
            continue;
        }
        $items = isset($collection['items']) && is_array($collection['items']) ? $collection['items'] : array();
        $taxonomy = '';
        $types = goodjob_ai_site_collection_types();
        if (isset($types[$post_type]['taxonomy'])) {
            $taxonomy = $types[$post_type]['taxonomy'];
        }
        foreach ($items as $item) {
            $title = sanitize_text_field($item['title'] ?? '');
            if (!$title) {
                continue;
            }
            $existing = get_page_by_title($title, OBJECT, $post_type);
            if ($existing && !$force) {
                continue;
            }
            $postarr = array(
                'post_title' => $title,
                'post_type' => $post_type,
                'post_status' => 'publish',
                'post_excerpt' => sanitize_textarea_field($item['desc'] ?? ''),
                'post_content' => wp_kses_post($item['content'] ?? $item['desc'] ?? ''),
                'post_date' => sanitize_text_field($item['date'] ?? current_time('mysql')),
            );
            $post_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
            if (is_wp_error($post_id)) {
                continue;
            }
            foreach ($item as $meta_key => $meta_value) {
                if (in_array($meta_key, array('title', 'desc', 'content', 'category', 'date', 'image', 'images'), true)) {
                    continue;
                }
                $clean_key = sanitize_key('goodjob_' . $meta_key);
                if (is_array($meta_value)) {
                    update_post_meta($post_id, $clean_key, wp_json_encode($meta_value, JSON_UNESCAPED_UNICODE));
                } else {
                    update_post_meta($post_id, $clean_key, sanitize_text_field((string) $meta_value));
                }
            }
            $image_list = array();
            if (isset($item['images']) && is_array($item['images'])) {
                foreach ($item['images'] as $image_item) {
                    $image_url = esc_url_raw((string) $image_item);
                    if ($image_url) {
                        $image_list[] = $image_url;
                    }
                }
            }
            if (!$image_list && !empty($item['image'])) {
                $image_url = esc_url_raw((string) $item['image']);
                if ($image_url) {
                    $image_list[] = $image_url;
                }
            }
            if ($image_list) {
                update_post_meta($post_id, 'goodjob_image', $image_list[0]);
                update_post_meta($post_id, 'goodjob_images', wp_json_encode($image_list, JSON_UNESCAPED_UNICODE));
            }
            if ($taxonomy && !empty($item['category'])) {
                $term = term_exists($item['category'], $taxonomy);
                if (!$term) {
                    $term = wp_insert_term($item['category'], $taxonomy);
                }
                if (!is_wp_error($term)) {
                    wp_set_object_terms($post_id, array((int) $term['term_id']), $taxonomy);
                }
            }
        }
    }
}

function goodjob_ai_site_write_htaccess() {
    $base = parse_url(home_url('/'), PHP_URL_PATH);
    $base = $base ? trailingslashit($base) : '/';
    $index = $base . 'index.php';
    $rules = "# BEGIN WordPress\n";
    $rules .= "<IfModule mod_rewrite.c>\n";
    $rules .= "RewriteEngine On\n";
    $rules .= "RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n";
    $rules .= "RewriteBase " . $base . "\n";
    $rules .= "RewriteRule ^index\\.php$ - [L]\n";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-f\n";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-d\n";
    $rules .= "RewriteRule . " . $index . " [L]\n";
    $rules .= "</IfModule>\n";
    $rules .= "# END WordPress\n";
    $file = ABSPATH . '.htaccess';
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rules);
    }
}

function goodjob_ai_site_write_nginx_rewrite() {
    $file = ABSPATH . 'nginx.htaccess';
    $rule = "try_files \\$uri \\$uri/ /index.php?\\$args;\n";
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rule);
    }
}

function goodjob_ai_site_configure_routes() {
    global $wp_rewrite;
    if (get_option('permalink_structure') !== '/%postname%/') {
        update_option('permalink_structure', '/%postname%/');
    }
    if ($wp_rewrite && method_exists($wp_rewrite, 'set_permalink_structure')) {
        $wp_rewrite->set_permalink_structure('/%postname%/');
    }
    goodjob_ai_site_write_htaccess();
    goodjob_ai_site_write_nginx_rewrite();
}

function goodjob_ai_site_seed_all($force = false) {
    goodjob_ai_site_register_cpts();
    goodjob_ai_site_configure_routes();
    goodjob_ai_site_seed_pages($force);
    goodjob_ai_site_seed_collections($force);
    update_option('goodjob_ai_site_options', goodjob_ai_site_read_json('_data/site-options.json'));
    update_option('goodjob_ai_site_seeded_at', current_time('mysql'));
    update_option('goodjob_ai_site_data_signature', goodjob_ai_site_data_signature());
    flush_rewrite_rules();
}
add_action('after_switch_theme', function () {
    if (!get_option('goodjob_ai_site_seeded_at') || get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
add_action('admin_init', function () {
    if (current_user_can('manage_options') && get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
`;
        const adminPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_admin_menu() {
    add_menu_page(
        'GoodJob AI Site',
        'GoodJob AI Site',
        'manage_options',
        'goodjob-ai-site',
        'goodjob_ai_site_admin_page',
        'dashicons-admin-site-alt3',
        58
    );
}
add_action('admin_menu', 'goodjob_ai_site_admin_menu');

function goodjob_ai_site_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $options = goodjob_ai_site_read_json('_data/site-options.json');
    $collections = goodjob_ai_site_read_json('_data/collections.json');
    $routes = goodjob_ai_site_read_json('_data/routes.json');
    echo '<div class="wrap"><h1>GoodJob AI Site</h1>';
    echo '<p>This page is generated by GoodJob. It shows the imported site options, seed collections, and install status.</p>';
    echo '<p><strong>Last seeded:</strong> ' . esc_html(get_option('goodjob_ai_site_seeded_at', 'Not seeded yet')) . '</p>';
    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
    wp_nonce_field('goodjob_ai_site_reseed');
    echo '<input type="hidden" name="action" value="goodjob_ai_site_reseed">';
    submit_button('Rebuild Pages and Seed Data');
    echo '</form>';
    echo '<h2>Site Options</h2><pre style="max-height:280px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($options, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '<h2>Route Blueprint</h2><pre style="max-height:360px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($routes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '<h2>Collections</h2><pre style="max-height:360px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($collections, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '</div>';
}

function goodjob_ai_site_handle_reseed() {
    if (!current_user_can('manage_options')) {
        wp_die('Permission denied');
    }
    check_admin_referer('goodjob_ai_site_reseed');
    goodjob_ai_site_seed_all(true);
    wp_safe_redirect(admin_url('admin.php?page=goodjob-ai-site&seeded=1'));
    exit;
}
add_action('admin_post_goodjob_ai_site_reseed', 'goodjob_ai_site_handle_reseed');
`;
        await writeFile(path.join(themeDir, "style.css"), styleCss, "utf8");
        await writeFile(path.join(themeDir, "theme.json"), JSON.stringify(themeJson, null, 2), "utf8");
        await writeFile(path.join(dataDir, "site-options.json"), JSON.stringify(siteOptions, null, 2), "utf8");
        await writeFile(path.join(dataDir, "collections.json"), JSON.stringify(collections, null, 2), "utf8");
        await writeFile(path.join(dataDir, "pages.json"), JSON.stringify(pages, null, 2), "utf8");
        await writeFile(path.join(dataDir, "routes.json"), JSON.stringify(routeBlueprint, null, 2), "utf8");
        await writeFile(path.join(incDir, "cpt.php"), cptPhp, "utf8");
        await writeFile(path.join(incDir, "acf.php"), acfPhp, "utf8");
        await writeFile(path.join(incDir, "installer.php"), installerPhp, "utf8");
        await writeFile(path.join(incDir, "admin.php"), adminPhp, "utf8");
        await writeFile(path.join(templatesDir, "index.html"), frontPageTemplate, "utf8");
        await writeFile(path.join(templatesDir, "front-page.html"), frontPageTemplate, "utf8");
        const archiveTemplates = {
            "archive-product.html": buildAiSiteWpProductsArchiveTemplate(),
            "taxonomy-product_cat.html": buildAiSiteWpProductsArchiveTemplate(),
            "archive-case.html": buildAiSiteWpArchiveTemplate({ title: "Cases", intro: "Explore delivery references, export coordination stories, and project proof from relevant industrial scenarios.", cpt: "case", mediaRatio: "4/3", tone: "case" }),
            "taxonomy-case_cat.html": buildAiSiteWpArchiveTemplate({ title: "Case Category", intro: "Review project references by scenario, market, or delivery type.", cpt: "case", mediaRatio: "4/3", tone: "case" }),
            "archive-news.html": buildAiSiteWpBlogArchiveTemplate(),
            "taxonomy-news_cat.html": buildAiSiteWpBlogArchiveTemplate(),
            "archive-service.html": buildAiSiteWpArchiveTemplate({ title: "Services", intro: "Review pre-sales, export, channel, and after-sales services that support B2B industrial buying.", cpt: "service", mediaRatio: "8/5", tone: "service" }),
            "taxonomy-service_cat.html": buildAiSiteWpArchiveTemplate({ title: "Service Category", intro: "Review service capabilities grouped by support stage and buyer need.", cpt: "service", mediaRatio: "8/5", tone: "service" }),
            "archive.html": buildAiSiteWpArchiveTemplate({ title: "Archive", intro: "Browse the latest published content from this industrial website.", cpt: "post", mediaRatio: "4/3", tone: "generic" }),
            "search.html": buildAiSiteWpSearchTemplate(),
            "404.html": buildAiSiteWp404Template()
        };
        const singleTemplates = {
            "single-product.html": buildAiSiteWpProductDetailTemplate(),
            "single-case.html": buildAiSiteWpSingleTemplate({ cpt: "case", tone: "case", cta: "Want to discuss a similar project or sourcing scenario?" }),
            "single-news.html": buildAiSiteWpNewsDetailTemplate(),
            "single-service.html": buildAiSiteWpSingleTemplate({ cpt: "service", tone: "service", cta: "Need this support for your current export or sourcing project?" }),
            "single.html": buildAiSiteWpSingleTemplate({ cpt: "post", tone: "generic", cta: "Contact the team for more information about this topic." })
        };
        for (const [templateName, templateContent] of Object.entries({ ...archiveTemplates, ...singleTemplates })) {
            await writeFile(path.join(templatesDir, templateName), templateContent, "utf8");
            files.push(`theme/templates/${templateName}`);
        }
        const nativeArchiveBlocks = [
            {
                slug: "products-archive",
                title: "Products Archive",
                icon: "products",
                render: buildAiSiteWpProductsArchiveRender(),
                style: buildAiSiteWpProductsArchiveStyle()
            },
            {
                slug: "blog-archive",
                title: "Blog Archive",
                icon: "media-document",
                render: buildAiSiteWpBlogArchiveRender(),
                style: buildAiSiteWpBlogArchiveStyle()
            },
            {
                slug: "product-detail",
                title: "Product Detail",
                icon: "products",
                render: buildAiSiteWpProductDetailRender(),
                style: buildAiSiteWpProductDetailStyle()
            },
            {
                slug: "news-detail",
                title: "News Detail",
                icon: "media-document",
                render: buildAiSiteWpNewsDetailRender(),
                style: buildAiSiteWpNewsDetailStyle()
            }
        ];
        for (const block of nativeArchiveBlocks) {
            const blockDir = path.join(blocksDir, block.slug);
            await mkdir(blockDir, { recursive: true });
            await writeFile(path.join(blockDir, "block.json"), JSON.stringify(buildAiSiteWpNativeArchiveBlockJson(block.slug, block.title, block.icon), null, 2), "utf8");
            await writeFile(path.join(blockDir, "render.php"), block.render, "utf8");
            await writeFile(path.join(blockDir, "style.css"), block.style, "utf8");
            files.push(`theme/blocks/${block.slug}/block.json`, `theme/blocks/${block.slug}/render.php`, `theme/blocks/${block.slug}/style.css`);
        }
        const functionsPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once get_stylesheet_directory() . '/inc/cpt.php';
require_once get_stylesheet_directory() . '/inc/acf.php';
require_once get_stylesheet_directory() . '/inc/installer.php';
require_once get_stylesheet_directory() . '/inc/admin.php';

function goodjob_ai_site_enqueue_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
    wp_enqueue_script(
        'goodjob-ai-site-script',
        get_stylesheet_directory_uri() . '/assets/js/goodjob-site.js',
        array(),
        $theme->get('Version'),
        true
    );
}
add_action('wp_enqueue_scripts', 'goodjob_ai_site_enqueue_assets');

function goodjob_ai_site_enqueue_editor_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-editor-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
}
add_action('enqueue_block_editor_assets', 'goodjob_ai_site_enqueue_editor_assets');

function goodjob_ai_site_theme_setup() {
    add_theme_support('post-thumbnails');
    add_theme_support('title-tag');
    add_theme_support('wp-block-styles');
    add_theme_support('align-wide');
}
add_action('after_setup_theme', 'goodjob_ai_site_theme_setup');
`;
        await writeFile(path.join(themeDir, "functions.php"), functionsPhp, "utf8");
        await writeFile(path.join(assetsJsDir, "goodjob-site.js"), aiSiteWpThemeScript(), "utf8");
        await writeFile(path.join(exportDir, "README.md"), readme, "utf8");
        await writeFile(path.join(exportDir, "wp-metadata.json"), JSON.stringify(state.wpMetadata, null, 2), "utf8");
        await writeFile(path.join(exportDir, "conversion-report.json"), JSON.stringify({ exportedAt, projectId: project.id, themeSlug, summary: state.summary, checks: state.checks }, null, 2), "utf8");
        files.push("theme/style.css", "theme/theme.json", "theme/templates/index.html", "theme/templates/front-page.html", "theme/functions.php", "theme/assets/js/goodjob-site.js", "theme/inc/cpt.php", "theme/inc/acf.php", "theme/inc/installer.php", "theme/inc/admin.php", "theme/_data/site-options.json", "theme/_data/collections.json", "theme/_data/pages.json", "theme/_data/routes.json", "README.md", "wp-metadata.json", "conversion-report.json");
        return { ...state, export: { exportDir, themeDir, themeSlug, exportedAt, files } };
    }
    async function installAiSiteWpRebuildPackage(project, wordpressRoot, themeSlugInput, overwrite = false) {
        const root = path.resolve(String(wordpressRoot || ""));
        if (!root || !(await fileExists(root)))
            throw new Error("WordPress root does not exist.");
        const wpConfigPath = path.join(root, "wp-config.php");
        const wpContentDir = path.join(root, "wp-content");
        const themesDir = path.join(wpContentDir, "themes");
        const hasWpConfig = await fileExists(wpConfigPath);
        const hasThemesDir = await fileExists(themesDir);
        if (!hasWpConfig && !hasThemesDir) {
            throw new Error("WordPress root must contain wp-config.php or wp-content/themes.");
        }
        const exported = await exportAiSiteWpRebuildPackage(project);
        const themeSlug = cleanAiSiteWpThemeSlug(themeSlugInput, exported.export.themeSlug);
        await mkdir(themesDir, { recursive: true });
        const writeProbe = path.join(themesDir, `.goodjob-install-probe-${Date.now()}.tmp`);
        try {
            await writeFile(writeProbe, "ok", "utf8");
            await rm(writeProbe, { force: true });
        }
        catch (error) {
            throw new Error(`WordPress themes directory is not writable: ${error instanceof Error ? error.message : String(error)}`);
        }
        const targetDir = path.join(themesDir, themeSlug);
        const targetExistsBefore = await fileExists(targetDir);
        let backupDir = "";
        if (await fileExists(targetDir)) {
            if (!overwrite)
                throw new Error("Target WordPress theme already exists. Rename the theme slug or enable overwrite after backup.");
            const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
            backupDir = path.join(themesDir, `${themeSlug}.backup-${backupStamp}`);
            await rename(targetDir, backupDir);
        }
        try {
            await cp(exported.export.themeDir, targetDir, { recursive: true });
        }
        catch (error) {
            if (backupDir && !(await fileExists(targetDir)) && (await fileExists(backupDir))) {
                await rename(backupDir, targetDir).catch(() => undefined);
            }
            throw new Error(`Failed to copy WordPress theme: ${error instanceof Error ? error.message : String(error)}`);
        }
        const requiredFiles = [
            "style.css",
            "functions.php",
            "templates/front-page.html",
            "templates/archive-product.html",
            "templates/single-product.html",
            "templates/archive-news.html",
            "templates/single-news.html",
            "blocks/products-archive/block.json",
            "blocks/products-archive/render.php",
            "blocks/blog-archive/block.json",
            "blocks/blog-archive/render.php",
            "blocks/product-detail/block.json",
            "blocks/product-detail/render.php",
            "blocks/news-detail/block.json",
            "blocks/news-detail/render.php",
            "_data/collections.json",
            "_data/pages.json",
            "_data/routes.json",
            "inc/cpt.php",
            "inc/installer.php",
            "inc/admin.php"
        ];
        const checks = await Promise.all(requiredFiles.map(async (relativePath) => ({
            file: relativePath,
            exists: await fileExists(path.join(targetDir, relativePath))
        })));
        const missingFiles = checks.filter((check) => !check.exists).map((check) => check.file);
        if (missingFiles.length) {
            throw new Error(`WordPress theme installation is incomplete. Missing files: ${missingFiles.join(", ")}`);
        }
        const routeHints = {
            home: "/",
            products: "/products/",
            productDetail: "/product/{product-slug}/",
            blog: "/blog/",
            newsDetail: "/news/{news-slug}/",
            contact: "/contact-us/"
        };
        const nextSteps = [
            "Activate the installed theme in wp-admin > Appearance > Themes.",
            "Open wp-admin > GoodJob AI Site and run the seed/rebuild action if pages or CPT content are empty.",
            "Open wp-admin > Settings > Permalinks and click Save Changes if product/news detail URLs return 404.",
            "Confirm Products and News have published sample items before testing single routes."
        ];
        const install = {
            wordpressRoot: root,
            themeSlug,
            targetDir,
            overwrite,
            backupDir: backupDir || null,
            installedAt: new Date().toISOString(),
            preflight: {
                hasWpConfig,
                hasWpContent: await fileExists(wpContentDir),
                hasThemesDir: await fileExists(themesDir),
                targetExistsBefore,
                sourceThemeDir: exported.export.themeDir
            },
            checks,
            routeHints,
            nextSteps
        };
        await writeFile(path.join(targetDir, "install-report.json"), JSON.stringify({ projectId: project.id, install }, null, 2), "utf8");
        return { ...exported, install };
    }
    function canSeeAiSiteProject(user, project) {
        return user.role === "admin" || user.role === "super_admin" || user.id === project.ownerId || (user.role === "manager" && user.teamId === project.teamId);
    }
    const aiSiteModelPresets = [
        { provider: "openai", label: "OpenAI 兼容接口", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
        { provider: "deepseek", label: "DeepSeek 深度求索", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
        { provider: "qwen", label: "通义千问", model: "qwen-plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
        { provider: "doubao", label: "豆包", model: "doubao-pro-32k", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
        { provider: "claude", label: "Claude 模型", model: "claude-3-5-sonnet-latest", baseUrl: "https://api.anthropic.com/v1" },
        { provider: "gemini", label: "Gemini 模型", model: "gemini-1.5-pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
        { provider: "ollama", label: "Ollama 本地模型", model: "llama3.1", baseUrl: "http://127.0.0.1:11434/v1" },
        { provider: "custom", label: "自定义模型", model: "", baseUrl: "" }
    ];
    function aiSiteProviderProtocol(provider) {
        if (provider === "claude")
            return "anthropic";
        if (provider === "gemini")
            return "gemini";
        return "openai-compatible";
    }
    async function testAiSiteBuilderModel(settings) {
        const missing = [
            settings.provider ? "" : "供应商",
            settings.model ? "" : "模型名称",
            settings.baseUrl ? "" : "接口地址",
            settings.apiKey || settings.provider === "ollama" ? "" : "接口密钥"
        ].filter(Boolean);
        if (missing.length) {
            return { ok: false, message: `缺少${missing.join("、")}，暂不能进入生成链路` };
        }
        if (process.env.NODE_ENV === "test") {
            return { ok: true, message: "本地配置检查通过；测试环境已跳过外部模型调用" };
        }
        const config = {
            id: `ai_site_${settings.ownerId}`,
            provider: settings.provider,
            protocol: aiSiteProviderProtocol(settings.provider),
            name: "AI建站模型配置",
            baseUrl: settings.baseUrl,
            model: settings.model,
            apiKey: settings.apiKey,
            enabled: settings.enabled,
            temperature: 0.1,
            useLeadFinder: false,
            useWebsiteParse: false,
            useScoring: false,
            useEmailDraft: false,
            useExam: false,
            ownerId: settings.ownerId,
            teamId: settings.teamId,
            updatedAt: settings.updatedAt
        };
        return testAiConfig(config);
    }
    function aiSiteSettingsToModelConfig(settings) {
        return {
            id: aiSiteMirrorConfigId(settings.ownerId),
            provider: settings.provider,
            protocol: aiSiteProviderProtocol(settings.provider),
            name: "AI建站模型配置",
            baseUrl: settings.baseUrl,
            model: settings.model,
            apiKey: settings.apiKey,
            enabled: settings.enabled,
            temperature: 0.25,
            useLeadFinder: false,
            useWebsiteParse: false,
            useScoring: false,
            useEmailDraft: false,
            useExam: false,
            ownerId: settings.ownerId,
            teamId: settings.teamId,
            updatedAt: settings.updatedAt
        };
    }
    function aiSiteMirrorConfigId(ownerId) {
        return `ai_site_${ownerId}`;
    }
    function aiSiteSettingFromAiConfig(config, user) {
        return {
            ownerId: user.id,
            teamId: user.teamId,
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            enabled: config.enabled,
            lastTestStatus: normalizeAiTestStatus(config.lastTestStatus),
            lastTestMessage: config.lastTestMessage || "",
            updatedAt: new Date().toISOString()
        };
    }
    async function syncAiSiteSettingFromAiConfig(config, user) {
        if (config.ownerId !== user.id)
            return;
        const store = getStore();
        const next = aiSiteSettingFromAiConfig(config, user);
        const index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === user.id);
        if (index >= 0)
            store.aiSiteBuilderSettings[index] = next;
        else
            store.aiSiteBuilderSettings.push(next);
        await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
    }
    function upsertAiConfigFromAiSiteSetting(settings) {
        const store = getStore();
        const id = aiSiteMirrorConfigId(settings.ownerId);
        const existing = store.aiModelConfigs.find((item) => item.id === id && item.ownerId === settings.ownerId);
        const next = {
            id,
            provider: settings.provider,
            protocol: aiSiteProviderProtocol(settings.provider),
            name: existing?.name || "AI建站模型配置",
            baseUrl: settings.baseUrl,
            model: settings.model,
            apiKey: settings.apiKey,
            enabled: settings.enabled,
            temperature: existing?.temperature ?? 0.25,
            useLeadFinder: existing?.useLeadFinder ?? true,
            useWebsiteParse: existing?.useWebsiteParse ?? true,
            useScoring: existing?.useScoring ?? true,
            useEmailDraft: existing?.useEmailDraft ?? true,
            useExam: existing?.useExam ?? false,
            lastTestAt: existing?.lastTestAt,
            lastTestStatus: normalizeAiTestStatus(settings.lastTestStatus || existing?.lastTestStatus),
            lastTestMessage: settings.lastTestMessage || existing?.lastTestMessage || "",
            ownerId: settings.ownerId,
            teamId: settings.teamId,
            updatedAt: settings.updatedAt
        };
        if (existing)
            Object.assign(existing, next);
        else
            store.aiModelConfigs.unshift(next);
        return existing || next;
    }
    function aiSiteModelReady(settings) {
        return Boolean(settings?.model && settings.baseUrl && (settings.apiKey || settings.provider === "ollama"));
    }
    function stripUnsafeAiSiteHtml(value, sectionKey) {
        let html = String(value || "").trim();
        html = html
            .replace(/```html/gi, "")
            .replace(/```/g, "")
            .replace(/<!doctype[^>]*>/gi, "")
            .replace(/<html[^>]*>/gi, "")
            .replace(/<\/html>/gi, "")
            .replace(/<head[\s\S]*?<\/head>/gi, "")
            .replace(/<body[^>]*>/gi, "")
            .replace(/<\/body>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
            .replace(/\shref\s*=\s*"(?!#|mailto:|tel:)[^"]*"/gi, " href=\"#\"")
            .replace(/\shref\s*=\s*'(?!#|mailto:|tel:)[^']*'/gi, " href=\"#\"")
            .replace(/\starget\s*=\s*"[^"]*"/gi, "")
            .replace(/\starget\s*=\s*'[^']*'/gi, "")
            .trim();
        if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
            throw new Error("模型返回疑似包含 CRM 主系统内容，已拒绝写入");
        }
        const fragment = html.match(/<(section|header|footer)\b[\s\S]*<\/\1>/i)?.[0];
        if (fragment)
            html = fragment.trim();
        if (!/^<(section|header|footer)\b/i.test(html)) {
            throw new Error("模型必须只返回一个 header/footer/section HTML 片段");
        }
        const expectedId = sectionKey === "hero" ? "(?:home|hero)" : sectionKey.replace(/_/g, "-");
        if (sectionKey !== "header" && sectionKey !== "footer" && !new RegExp(`<section\\b[\\s\\S]*id=["']${expectedId}["']`, "i").test(html)) {
            html = html.replace(/^<section\b/i, `<section id="${sectionKey === "hero" ? "home" : sectionKey.replace(/_/g, "-")}"`);
        }
        return html;
    }
    function aiSiteHtmlFromModelOutput(content, sectionKey) {
        try {
            const parsed = extractJsonObject(content);
            if (parsed.html)
                return stripUnsafeAiSiteHtml(parsed.html, sectionKey);
        }
        catch {
            // Some OpenAI-compatible providers ignore JSON mode; use their raw HTML safely.
        }
        return stripUnsafeAiSiteHtml(content, sectionKey);
    }
    function aiSiteCssRuleBlocks(css) {
        return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
            selector: match[1].trim(),
            body: match[2].trim()
        }));
    }
    function aiSiteGradientCount(value) {
        return (value.match(/(?:linear|radial|conic)-gradient\s*\(/gi) || []).length;
    }
    function aiSiteIsLargeSurfaceSelector(selector, sectionId) {
        const escapedId = sectionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rootLike = new RegExp(`#${escapedId}(?:\\b|[.:#\\[]|$)`, "i").test(selector) && !/\s[#.a-z0-9_-]/i.test(selector.replace(new RegExp(`#${escapedId}`, "i"), ""));
        const fullOverlay = new RegExp(`#${escapedId}(?:::?before|::?after)`, "i").test(selector);
        return rootLike || fullOverlay;
    }
    function aiSiteCssHasHardSplitGradient(css) {
        return /linear-gradient\([^)]*\b(\d{1,3}(?:\.\d+)?)%\s*,\s*(?:#[0-9a-f]{3,8}|rgba?\([^)]*\)|var\([^)]*\)|[a-z]+)\s+\1%/i.test(css);
    }
    function aiSiteUnsafeLargeGradientReason(css, sectionId) {
        if (aiSiteCssHasHardSplitGradient(css)) {
            return "uses a hard-split gradient that can create broken half-color bands";
        }
        for (const block of aiSiteCssRuleBlocks(css)) {
            const body = block.body;
            if (!/gradient\s*\(/i.test(body) || !aiSiteIsLargeSurfaceSelector(block.selector, sectionId))
                continue;
            const backgroundDeclaration = (body.match(/(?:^|;)\s*background(?:-image)?\s*:\s*([^;]+)/i) || [])[1] || "";
            const gradients = aiSiteGradientCount(backgroundDeclaration);
            const fullOverlay = /::?before|::?after/i.test(block.selector) && /position\s*:\s*absolute/i.test(body) && /inset\s*:\s*0/i.test(body);
            if (/radial-gradient\s*\(/i.test(backgroundDeclaration) && (fullOverlay || gradients > 1)) {
                return "uses a large radial-gradient overlay; use image masks, solid/tinted surfaces, or small accents instead";
            }
            if (gradients > 2 || (fullOverlay && gradients > 1)) {
                return "uses too many gradients on a full-section surface; keep gradients to localized accents";
            }
        }
        return "";
    }
    function validateGeneratedAiSiteSectionHtml(html, sectionKey, project) {
        if (aiSiteLockedSections.has(sectionKey))
            return;
        const sectionId = sectionKey.replace(/_/g, "-");
        const expectedId = sectionKey === "hero" ? "(?:home|hero)" : sectionId;
        const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1].trim()).filter(Boolean);
        if (!styleBlocks.length)
            throw new Error(`Generated ${sectionId}.html is missing a scoped <style> block`);
        const css = styleBlocks.join("\n").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
        const declarationCount = (css.match(/:[^;{}]+;/g) || []).length;
        const minCssLength = sectionKey === "hero" ? 420 : 520;
        const minDeclarationCount = sectionKey === "hero" ? 18 : 24;
        if (css.length < minCssLength || declarationCount < minDeclarationCount) {
            throw new Error(`Generated ${sectionId}.html CSS is too thin (${declarationCount} declarations)`);
        }
        const scopePattern = new RegExp(sectionKey === "hero" ? "#(?:home|hero)(?:\\b|\\s|[.#:{>])" : `#${sectionId}(?:\\b|\\s|[.#:{>])`, "i");
        if (!scopePattern.test(css))
            throw new Error(`Generated ${sectionId}.html CSS is not scoped to #${sectionId}`);
        if (!new RegExp(`<section\\b[\\s\\S]*id=["']${expectedId}["']`, "i").test(html)) {
            throw new Error(`Generated ${sectionId}.html is missing the required section id`);
        }
        if (sectionKey !== "hero" && !/class=["'][^"']*\bai-section\b/i.test(html)) {
            throw new Error(`Generated ${sectionId}.html must use the shared ai-section framework class`);
        }
        if (sectionKey === "hero") {
            if (/@keyframes\s*#/i.test(css) || /animation(?:-[a-z-]+)?\s*:\s*#/i.test(css)) {
                throw new Error("Generated hero.html contains an invalid # keyframe/animation name");
            }
            if ((html.match(/data-upload-slot=["']hero-background-/gi) || []).length < 3) {
                throw new Error("Generated hero.html must include 3 data-upload-slot hero background hooks");
            }
        }
        if (sectionKey === "contact_us") {
            const inputCount = (html.match(/<input\b/gi) || []).length;
            if (!/<form\b/i.test(html))
                throw new Error("Generated contact-us.html must include a real inquiry <form>");
            if (inputCount < 5)
                throw new Error("Generated contact-us.html must include name, country, email, product/project type, and target capacity inputs");
            if (!/<textarea\b/i.test(html))
                throw new Error("Generated contact-us.html must include a project details textarea");
            if (!/SEND\s+INQUIRY|Request\s+a\s+Free\s+Proposal/i.test(html))
                throw new Error("Generated contact-us.html must include the fixed inquiry form CTA");
        }
        if (sectionKey === "products" || sectionKey === "applications" || sectionKey === "about_us") {
            if (/href=["']#["']/i.test(html)) {
                throw new Error(`Generated ${sectionId}.html contains inert href="#" controls; use #contact-us or script-free radio label controls`);
            }
        }
        if (sectionKey === "products") {
            if (!/products-category-showcase/i.test(html))
                throw new Error("Generated products.html must keep the products-category-showcase structure");
            if (!/<(button|label)\b[\s\S]*(products|category|pill|tab)/i.test(html))
                throw new Error("Generated products.html must include clickable category controls");
            if (!/data-product-category=["']/i.test(html))
                throw new Error("Generated products.html category controls must include data-product-category hooks");
            if ((html.match(/<article\b/gi) || []).length < 4)
                throw new Error("Generated products.html must include at least 4 product preview cards");
        }
        if (sectionKey === "applications") {
            if (!/applications-horizontal-card-preview/i.test(html))
                throw new Error("Generated applications.html must keep the horizontal application card preview structure");
            if ((html.match(/<article\b/gi) || []).length < 3)
                throw new Error("Generated applications.html must include at least 3 application preview cards");
        }
        if (sectionKey === "about_us") {
            if (!/about-us-capability-stack-and-quality-process/i.test(html))
                throw new Error("Generated about-us.html must keep the capability stack and quality process structure");
            if (!/capability/i.test(html) || !/(quality|inspection|documentation|process)/i.test(html))
                throw new Error("Generated about-us.html must include capability and quality/process proof content");
        }
        if (project && !aiSiteLockedSections.has(sectionKey)) {
            const design = aiSiteDesignSystem(project);
            const userColors = [
                design.palette.brand,
                design.palette.accent,
                design.palette.surface,
                design.palette.brandDeep,
                design.palette.dark
            ].map((color) => color.toLowerCase());
            const cssText = css.toLowerCase();
            const usesPaletteLiteral = userColors.some((color) => cssText.includes(color));
            const usesFrameworkToken = /var\(--(?:blue|red|blue-deep|bg-soft|footer|ink|body|mid|line)\b/i.test(css);
            if (!usesPaletteLiteral && !usesFrameworkToken) {
                throw new Error(`Generated ${sectionId}.html does not use the project palette or framework color tokens`);
            }
        }
        if (!/@media/i.test(css))
            throw new Error(`Generated ${sectionId}.html CSS is missing responsive @media rules`);
        if (!/(clamp\(|minmax\(|auto-fit|grid-template-columns|flex-wrap)/i.test(css)) {
            throw new Error(`Generated ${sectionId}.html CSS is missing responsive layout primitives`);
        }
        if (/(^|[}\s,])(body|html|:root)\s*\{/i.test(css)) {
            throw new Error(`Generated ${sectionId}.html CSS contains unsafe global selectors`);
        }
    }
    function aiSiteBlueprintSignals(plan, schema) {
        const text = plan.toLowerCase();
        const categories = sectionArray(schema.business_taxonomy.product_categories);
        const signals = [
            categories.length ? `${Math.min(categories.length, 10)} product families available` : "no product families supplied",
            schema.contact_info.phone ? "phone CTA available" : "",
            schema.contact_info.email ? "email CTA available" : "",
            schema.company_profile.description ? "company description available" : ""
        ];
        if (/cert|quality|iso|test|inspection|factory|manufactur/i.test(text))
            signals.push("quality/manufacturing proof");
        if (/case|project|deliver|result|export|buyer|value/i.test(text))
            signals.push("delivery proof");
        if (/application|scenario|environment|pain|operating/i.test(text))
            signals.push("application scenario logic");
        if (/seo|guide|knowledge|article|insight|blog/i.test(text))
            signals.push("editorial/SEO intent");
        return signals.filter(Boolean).slice(0, 8);
    }
    function aiSiteSectionLayoutStrategy(project, sectionKey) {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const blueprint = cleanAiSiteBlueprint(project);
        const plan = blueprint[sectionKey] || "";
        const styleProfile = aiSiteDesignSystem(project).styleProfile;
        const categories = sectionArray(schema.business_taxonomy.product_categories);
        const signals = [
            `style mood: ${styleProfile.mood}`,
            `style density: ${styleProfile.density}`,
            `style geometry: ${styleProfile.shape}`,
            `style composition: ${styleProfile.composition}`,
            ...aiSiteBlueprintSignals(plan, schema)
        ];
        const categoryInstruction = categories.length
            ? `Use these category labels as real content anchors: ${categories.slice(0, 10).join(", ")}.`
            : "Create realistic industrial category labels from the company description.";
        const variantSpec = aiSiteSelectVariantSpec(project, sectionKey);
        const variant = aiSiteSectionVariantMeta(variantSpec);
        const strategies = {
            header: {
                family: "locked_fixed_header",
                blueprintSignals: signals,
                composition: ["Locked framework component; do not generate with this prompt."],
                requiredElements: [],
                avoid: []
            },
            hero: {
                family: "darkened_photo_hero_slider",
                blueprintSignals: signals,
                composition: [
                    "Build one compact full-width hero section that visually occupies about 72vh.",
                    "Use 3 external industrial photo backgrounds with a dark overlay strong enough for clear white text.",
                    "Create a company-specific headline from the form data; do not force a generic Industrial ... formula. Keep the H1 visually to 2 lines maximum.",
                    "Place eyebrow, oversized H1, short subtitle, and exactly two buttons: Request a Proposal and Learn More.",
                    "Put working previous/next square controls plus a current slide indicator such as 01 / 03 in the bottom-right corner.",
                    "Use script-free HTML/CSS radio inputs and labels for manual switching; use CSS keyframes for automatic background switching every 6 seconds."
                ],
                requiredElements: ["one H1 clamped to 2 lines", "one subtitle paragraph", "exactly two CTA links", "3 darkened image backgrounds", "working bottom-right prev/next controls", "slide status indicator", "CSS auto-switch every 6 seconds", "data-upload-slot markers for future custom image upload"],
                avoid: ["cards", "metrics", "proof strip", "stats rail", "grids", "decorative panels", "extra content blocks", "two-column split"]
            },
            products: {
                family: "product_category_tabs_catalog_slider",
                blueprintSignals: [...signals, categoryInstruction],
                composition: [
                    "Build a reference-style Product Category catalog section from top to bottom.",
                    "Start with a centered Product Category heading and one concise explanatory line.",
                    "Place product category pill buttons in a horizontal wrapped row; highlight the current category.",
                    "Below the buttons, show the current category product catalog as large image cards with uppercase product names.",
                    "Put previous/next browsing arrows on the left and right sides of the product card stage; use script-free radio inputs and labels if interaction is needed."
                ],
                requiredElements: ["Product Category h2", "one explanation paragraph", "category pill buttons", "4 visible product cards", "left and right browsing arrows", "responsive catalog grid"],
                avoid: ["specification matrix", "proof strip", "identical 3-card layout", "plain list only", "image-left text-right split", "crowded card columns"]
            },
            applications: {
                family: "applications_horizontal_card_preview",
                blueprintSignals: signals,
                composition: [
                    "Create a horizontal application card preview section.",
                    "Start with a readable title block, then a row of wide application cards that preview operating environment, buyer pain point, suitable product, and outcome.",
                    "Use a full-surface background and card surfaces; do not split the section background with hard percentage color stops.",
                    "Cards may scroll or wrap, but the desktop first view should feel like a horizontal preview carousel.",
                    "Keep all CTA controls clickable and above decorative layers."
                ],
                requiredElements: ["3-5 horizontal application cards", "pain point labels", "matching product chips", "outcome notes", "clickable CTA to #contact-us", "high-contrast headings on dark or light backgrounds"],
                avoid: ["hard-split gradient bands", "low-contrast dark text on blue backgrounds", "same product card layout", "generic features grid", "two-column split", "decorative overlays covering controls"]
            },
            about_us: {
                family: "capability_stack_and_quality_process",
                blueprintSignals: signals,
                composition: [
                    "Use a refined institutional About Us section with a clear title block, capability stack, documentation proof, reliability note, and quality/export process belt.",
                    "Use one continuous full-surface background; do not split the section background with hard percentage color stops.",
                    "Place dark panels and light cards as deliberate surfaces, with explicit text colors for every heading and paragraph group.",
                    "Show the company as an operating system: facilities, standards, response, documentation.",
                    "Make this section calmer and more institutional than Products or Applications."
                ],
                requiredElements: ["capability stack", "quality/export process", "documentation or certification proof", "company reliability statement", "high-contrast headings on dark or light backgrounds", "CTA to #contact-us"],
                avoid: ["hard-split gradient bands", "low-contrast dark text on blue backgrounds", "founder story card grid", "same 3-column cards", "left text plus right image", "oversized decorative badge", "decorative overlays covering controls"]
            },
            blog: {
                family: "industrial_editorial_digest",
                blueprintSignals: signals,
                composition: [
                    "Use an editorial layout: one featured guide, then compact article rows or a knowledge index.",
                    "Organize posts by buyer intent such as selection guide, maintenance, troubleshooting, and market insight.",
                    "Include SEO tags or reading paths so it does not look like another product grid.",
                    "Use white space and typography to make it feel like an industrial knowledge center."
                ],
                requiredElements: ["featured article", "3-4 article rows", "SEO/intent tags", "knowledge CTA"],
                avoid: ["same cards as Products", "large equal blocks only", "fake news feed clutter", "two-column split"]
            },
            contact_us: {
                family: "inquiry_command_center",
                blueprintSignals: signals,
                composition: [
                    "Build a fixed inquiry section with a left trust/CTA column and a right buyer inquiry form panel.",
                    "The form panel is mandatory and must stay visible as the primary conversion element.",
                    "Use compact contact method strips, inquiry checklist, and response promise inside or below the left column.",
                    "Place phone/email/location/social data as operational channels, not oversized cards.",
                    "On mobile, stack the trust column before the inquiry form while preserving all form fields."
                ],
                requiredElements: ["left trust/CTA column", "right white inquiry form panel", "real form element", "name input", "country input", "email input", "product/project type input", "target capacity input", "project details textarea", "SEND INQUIRY submit button", "phone/email/location channels when available", "RFQ checklist", "response promise"],
                avoid: ["contact-only cards without form", "map placeholder", "same grid as Footer", "unusable form controls", "form hidden below decorative content"]
            },
            footer: {
                family: "locked_fixed_footer",
                blueprintSignals: signals,
                composition: ["Locked framework component; do not generate with this prompt."],
                requiredElements: [],
                avoid: []
            }
        };
        const selected = strategies[sectionKey] || {
            family: "custom_simple_page",
            blueprintSignals: signals,
            composition: [
                "Build one simple standalone custom page section.",
                "Use a clear heading, concise explanatory copy, one practical content band, and a small CTA row.",
                "Keep the layout easy to edit and suitable for later conversion into a WordPress block."
            ],
            requiredElements: ["custom page heading", "intro copy", "one content band", "CTA row", "responsive single-column mobile layout"],
            avoid: ["full homepage shell", "header/footer duplication", "CRM links", "login/logout controls", "complex multi-section page"]
        };
        return {
            ...selected,
            family: variant.id,
            variant,
            composition: [
                ...selected.composition,
                `Variant contract (${variant.title}): ${variant.structure.join(" -> ")}.`,
                `Variant interactions: ${variant.interactions.join("; ")}.`,
                `Responsive contract: ${variant.responsive}.`
            ],
            requiredElements: [...new Set([...selected.requiredElements, ...variant.structure])],
            avoid: [...new Set([...selected.avoid, ...variant.avoid])]
        };
    }
    function aiSiteWpRole(sectionKey) {
        if (sectionKey === "header" || sectionKey === "footer")
            return "template-part";
        if (!aiSiteSectionLabel(sectionKey))
            return "custom-page-section";
        return "block";
    }
    function aiSiteWpTarget(sectionKey, layoutVariant) {
        if (sectionKey === "header")
            return "template-parts/header.html";
        if (sectionKey === "footer")
            return "template-parts/footer.html";
        const targets = {
            hero: "blocks/hero-photo-slider",
            products: "blocks/products-category-catalog",
            applications: "blocks/applications-scenario-map",
            about_us: "blocks/about-capability-stack",
            blog: "blocks/recent-blogs-split",
            contact_us: "blocks/contact-inquiry-form"
        };
        if (targets[sectionKey])
            return targets[sectionKey];
        return `patterns/${layoutVariant.replace(/_/g, "-")}`;
    }
    function aiSiteWpSectionType(sectionKey) {
        if (sectionKey === "header" || sectionKey === "footer")
            return "template_part";
        if (!aiSiteSectionLabel(sectionKey))
            return "custom_page";
        return sectionKey;
    }
    function buildAiSiteWpSectionMeta(project, sectionKey, orderIndex, customPages, existing) {
        const label = aiSiteSectionLabel(sectionKey, customPages);
        const strategy = aiSiteSectionLayoutStrategy(project, sectionKey);
        const variant = strategy.variant;
        const layoutVariant = existing?.layout_variant || strategy.family;
        const locked = aiSiteLockedSections.has(sectionKey);
        return {
            section_key: sectionKey,
            label,
            section_type: aiSiteWpSectionType(sectionKey),
            layout_variant: layoutVariant,
            variant_title: variant.title,
            variant,
            source_file: `sections/${sectionKey}.html`,
            wp_role: existing?.wp_role || aiSiteWpRole(sectionKey),
            wp_target: existing?.wp_target || variant.wp_target || aiSiteWpTarget(sectionKey, layoutVariant),
            status: existing?.status || (locked ? "locked" : "blueprint"),
            locked,
            order_index: orderIndex,
            updated_at: new Date().toISOString()
        };
    }
    async function readAiSiteWpMetadata(project, order, customPages) {
        const existing = await readJsonFile(aiSiteWpMetadataFile(project.id), null);
        const existingSections = new Map((existing?.sections || []).map((item) => [item.section_key, item]));
        const sections = order.map((sectionKey, index) => buildAiSiteWpSectionMeta(project, sectionKey, index, customPages, existingSections.get(sectionKey)));
        const designSystem = aiSiteDesignSystem(project);
        const metadata = {
            version: "1.1",
            project_id: project.id,
            site_name: project.siteName,
            site_template: existing?.site_template || "b2b_industrial",
            wp_mode: "block-theme",
            updated_at: new Date().toISOString(),
            design_system: {
                version: designSystem.version,
                preset: designSystem.preset,
                palette: designSystem.palette,
                style_profile: designSystem.styleProfile.summary,
                registry_version: "section-variant-registry.v1"
            },
            variant_registry: aiSiteVariantRegistryMeta(),
            sections,
            next_stage: {
                page: "WordPress重构",
                purpose: "Convert checked HTML sections into WordPress block theme parts, patterns, export package, and optional local install.",
                status: "metadata_ready"
            }
        };
        await writeFile(aiSiteWpMetadataFile(project.id), JSON.stringify(metadata, null, 2), "utf8");
        return metadata;
    }
    async function writeAiSiteWpMetadata(metadata) {
        await writeFile(aiSiteWpMetadataFile(metadata.project_id), JSON.stringify(metadata, null, 2), "utf8");
    }
    function buildAiSiteSectionPrompt(project, sectionKey, repairReason = "", userInstruction = "") {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const blueprint = cleanAiSiteBlueprint(project);
        const designSystem = aiSiteDesignSystem(project);
        const styleProfile = designSystem.styleProfile;
        const layoutStrategy = aiSiteSectionLayoutStrategy(project, sectionKey);
        const referenceDesignContext = aiSiteReferenceDesignContext(project);
        const referenceDesignContract = referenceDesignContext
            ? `Reference website brief: ${referenceDesignContext}\nUse this brief as a style/layout direction layer. Preserve the current section variant, WordPress block constraints, user palette, and CPT/export contracts. Do not copy exact text, images, logos, code, or external assets from the reference site.`
            : "Reference website brief: none analyzed yet. If raw reference URLs exist in style_requirements, treat them only as weak hints until /reference-sites/analyze creates a structured brief.";
        const sectionId = sectionKey.replace(/_/g, "-");
        const sectionLabel = aiSiteSectionLabel(sectionKey);
        const variantContract = `Variant registry contract: use variant "${layoutStrategy.variant.id}" (${layoutStrategy.variant.title}). Preserve this structure order: ${layoutStrategy.variant.structure.join(" -> ")}. Enrich only through visual tokens (${layoutStrategy.variant.visual_tokens.join(", ")}), spacing, surfaces, component details, micro-animation, and copy; do not invent a different section type.`;
        const paletteContract = `Palette contract: the user-selected palette is mandatory. Use brand ${designSystem.palette.brand}, accent ${designSystem.palette.accent}, surface ${designSystem.palette.surface}, brandDeep ${designSystem.palette.brandDeep}, and dark ${designSystem.palette.dark} as literal hex values or via framework tokens var(--blue), var(--red), var(--bg-soft), var(--blue-deep), var(--footer). Do not keep default #244aa5/#143A7B/#C8161C/#f97316 unless those exact colors are in the user palette.`;
        const styleExecutionContract = `Style execution contract: user style requirements override the default industrial template. Follow style_profile mood "${styleProfile.mood}", density "${styleProfile.density}", geometry "${styleProfile.shape}", background "${styleProfile.background}", composition "${styleProfile.composition}", CTA "${styleProfile.ctaStyle}", and custom notes "${styleProfile.customNotes || "none"}". If the style mentions retro, Y2K, vintage, old web, millennium, 复古, 千禧, 老网页, or 古早, use boxed old-web surfaces, visible borders, compact typography, nostalgic green/blue/white treatments, and do not output the sleek blue industrial template.`;
        const styleExecutionContractV2 = `Strict style contract v2: user colors, keywords, and custom notes are first-class requirements. Apply the style visibly to at least four layers: section background or surface, card/panel treatment, heading/eyebrow treatment, CTA/button shape, borders/dividers, image treatment, or micro-interaction. Do not satisfy the style by changing only one button color. Raw style input: ${JSON.stringify(schema.style_requirements)}.`;
        const gradientDisciplineContract = sectionKey === "hero"
            ? "Gradient rule: Hero may use dark image overlays only; keep the user palette visible in CTA, badge, slider controls, and overlay tint."
            : "Gradient discipline: rich details are allowed, but gradients must be localized and intentional. You may use subtle two-color gradients for buttons, image overlays, badges, divider lines, hover states, or small accent panels. Do not use hard-split percentage backgrounds, full-section radial blobs, glassmorphism washes, or stacked multi-gradient backgrounds on the root section. Prefer solid/tinted section surfaces plus varied cards, image areas, borders, chips, timelines, and structured panels.";
        if (sectionKey === "hero") {
            const company = schema.company_profile;
            const heroBrief = {
                brand: company.wordmark || company.legal_name || project.siteName,
                tagline: company.tagline,
                description: company.description,
                plan: blueprint.hero,
                palette: designSystem.palette,
                style_profile: styleProfile,
                layout: layoutStrategy
            };
            return [
                "Generate one premium B2B industrial HERO section. Return only JSON: {\"html\":\"...\"}.",
                "Speed mode: keep output compact. No explanations. No markdown.",
                `Required root: <section id="home" class="ai-hero ai-photo-hero">`,
                "First child inside the section must be one scoped <style>. Every selector must start with #home.",
                repairReason ? `Previous output failed validation: ${repairReason}` : "",
                userInstruction ? `User directional instruction: ${userInstruction}` : "",
                variantContract,
                paletteContract,
                styleExecutionContract,
                styleExecutionContractV2,
                referenceDesignContract,
                gradientDisciplineContract,
                "Hero composition: 3 external industrial photo backgrounds; height about 72vh; dark overlay so white text is clearly readable.",
                "Theme color rule: use the palette from Brief JSON as literal hex colors inside the scoped CSS. The overlay gradient, eyebrow badge, primary CTA, arrow hover/focus state, and status indicator must visibly reflect brand/accent/brandDeep. Do not rely only on CSS variables and do not fall back to the old navy/red palette unless the palette actually matches it.",
                "Style rule: follow Brief JSON style_profile for mood, density, geometry, CTA style, and background treatment while keeping the required hero contract.",
                "Content only: eyebrow badge, H1, one subtitle paragraph, two buttons named exactly Request a Proposal and Learn More.",
                "Headline rule: create a suitable company-specific headline from the form data. Do not force the generic 'Industrial ...' wording. CSS must visually limit H1 to 2 lines with max-width and line clamp or balanced wrapping.",
                "Bottom-right only: working previous/next arrow controls and slide status text like 01 / 03.",
                "Interaction: no script. Use hidden radio inputs plus label controls for manual switching. The exported WordPress theme will also enhance the section with a 6-second slider timer, so keep stable hooks and never name keyframes with # or an ID-like value.",
                "Future upload hook: add data-hero-image-api=\"/api/ai-site-builder/projects/{projectId}/hero-backgrounds\" on the section and data-upload-slot=\"hero-background-1/2/3\" on each background element.",
                "Do not add cards, metrics, proof strips, stats, grids, side panels, extra sections, forms, testimonials, or product lists.",
                "Use reliable external image URLs in CSS background-image, preferably industrial plant/factory/mining/manufacturing photos from images.unsplash.com with auto=format&fit=crop&w=1800&q=80. If unsure, use neutral placeholder background URLs and keep upload hooks.",
                "CSS quality: 24-56 declarations, include @media(max-width:760px), use clamp(), min-height:72vh, background-size:cover, and safe 16:9 spacing.",
                "Links: Request a Proposal href=\"#contact-us\"; Learn More href=\"#products\". No external links except the CSS background image URL.",
                "Brief JSON: " + JSON.stringify(heroBrief)
            ].filter(Boolean).join("\n");
        }
        if (sectionKey === "products") {
            const productsBrief = {
                categories: sectionArray(schema.business_taxonomy.product_categories),
                brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
                plan: blueprint.products,
                palette: designSystem.palette,
                style_profile: styleProfile,
                layout: layoutStrategy
            };
            return [
                "Generate one premium B2B industrial PRODUCTS catalog section. Return only JSON: {\"html\":\"...\"}.",
                "Speed mode: compact output. No explanations. No markdown.",
                `Required root: <section id="${sectionId}" class="ai-section products-category-showcase">`,
                "First child inside the section must be one scoped <style>. Every selector must start with #products.",
                repairReason ? `Previous output failed validation: ${repairReason}` : "",
                userInstruction ? `User directional instruction: ${userInstruction}` : "",
                variantContract,
                paletteContract,
                styleExecutionContract,
                styleExecutionContractV2,
                referenceDesignContract,
                gradientDisciplineContract,
                "Layout must match this top-to-bottom order: Product Category heading, one explanation paragraph, category pill buttons, current category product catalog cards, left/right browsing arrows.",
                "Style rule: follow Brief JSON style_profile for mood, density, geometry, card treatment, CTA shape, and background treatment. Keep global consistency but avoid copying the same visual formula as Hero or other sections.",
                "Cards: show 4 large product cards in the first view. Each card needs a square or near-square product image area, uppercase product name, and a small bottom-right inquiry arrow.",
                "Background safety: do not use hard-split linear-gradient backgrounds such as dark 18% then light 18%; use one continuous section background plus separate card/tab surfaces. Avoid absolute decorative layers unless they have pointer-events:none and z-index below content.",
                "Contrast safety: headings, tabs, product names, and arrows must have WCAG-like readable contrast. Never put dark gray or black text directly on a dark blue background; use white/light text on dark surfaces and dark text on light cards.",
                "Interaction: no script. Browsing arrows must be <label> controls for hidden radio inputs and must visibly switch product pages. Category controls must be real <button type=\"button\" class=\"products-tab\" data-product-category=\"Category Name\"> controls, not inert spans. The exported WordPress theme JS uses data-product-category to switch the active category and update visible cards.",
                "Clickable links: product inquiry arrows must use href=\"#contact-us\". Do not output href=\"#\".",
                "Images: use realistic product image URLs when safe, otherwise use placeholder URLs such as https://placehold.co/560x420/f8fafc/244aa5?text=Product. Do not use external page links.",
                "Avoid: specification matrix, proof strip, generic 3-card layout, image-left text-right split, forms, testimonials, CRM/login/logout/app links.",
                "CSS quality: 28-64 declarations, include @media(max-width:760px), use grid-template-columns, minmax() or clamp(), and avoid fixed widths over 420px.",
                "Copy: English, concise, product-buyer focused. Use the product categories from the JSON as button labels and card naming anchors.",
                "Brief JSON: " + JSON.stringify(productsBrief)
            ].filter(Boolean).join("\n");
        }
        if (sectionKey === "applications") {
            const applicationsBrief = {
                categories: sectionArray(schema.business_taxonomy.product_categories),
                brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
                plan: blueprint.applications,
                palette: designSystem.palette,
                style_profile: styleProfile,
                layout: layoutStrategy
            };
            return [
                "Generate one premium B2B industrial APPLICATIONS horizontal card preview section. Return only JSON: {\"html\":\"...\"}.",
                "Speed mode: compact output. No explanations. No markdown.",
                `Required root: <section id="${sectionId}" class="ai-section applications-horizontal-card-preview">`,
                "First child inside the section must be one scoped <style>. Every selector must start with #applications.",
                repairReason ? `Previous output failed validation: ${repairReason}` : "",
                userInstruction ? `User directional instruction: ${userInstruction}` : "",
                variantContract,
                paletteContract,
                styleExecutionContract,
                styleExecutionContractV2,
                referenceDesignContract,
                gradientDisciplineContract,
                "Layout contract: top readable title block, then a horizontal preview row of 3-5 application cards. Each card maps operating environment -> buyer pain point -> suitable product/category -> outcome.",
                "Structure contract: use <article> for each application card. Cards should be wide, visually distinct, and arranged with grid-auto-flow:column, overflow-x:auto, scroll-snap, or a responsive grid that reads horizontally on desktop.",
                "Preserve Applications direction: this is not a vertical process lane and not a generic feature grid. It must look like a horizontal application card preview.",
                "Background safety: do not use hard-split linear-gradient backgrounds such as dark 22% then light 22%; use one continuous section background plus card surfaces. If decorative pseudo-elements are used, set pointer-events:none and keep them behind content.",
                "Contrast safety: all text on dark blue/brand surfaces must be white or very light. All gray body text must sit on light cards. Eyebrow labels must not be gray on blue.",
                "Interaction safety: CTA buttons and card links must use href=\"#contact-us\" or href=\"#products\". Do not output href=\"#\". Decorative layers must not cover links.",
                "Required content: 3-5 application cards, pain point label, product/category chips, outcome note, one CTA to #contact-us.",
                "CSS quality: 30-68 declarations, include @media(max-width:760px), use clamp(), minmax(), grid-template-columns or grid-auto-flow, and avoid fixed card widths over 420px.",
                "Copy: English, concrete, buyer-facing, 100-190 words max. Use real product/category clues from JSON.",
                "Brief JSON: " + JSON.stringify(applicationsBrief)
            ].filter(Boolean).join("\n");
        }
        if (sectionKey === "about_us") {
            const aboutBrief = {
                brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
                company: schema.company_profile,
                categories: sectionArray(schema.business_taxonomy.product_categories),
                plan: blueprint.about_us,
                palette: designSystem.palette,
                style_profile: styleProfile,
                layout: layoutStrategy
            };
            return [
                "Generate one premium B2B industrial ABOUT US capability and quality process section. Return only JSON: {\"html\":\"...\"}.",
                "Speed mode: compact output. No explanations. No markdown.",
                `Required root: <section id="${sectionId}" class="ai-section about-us-capability-stack-and-quality-process">`,
                "First child inside the section must be one scoped <style>. Every selector must start with #about-us.",
                repairReason ? `Previous output failed validation: ${repairReason}` : "",
                userInstruction ? `User directional instruction: ${userInstruction}` : "",
                variantContract,
                paletteContract,
                styleExecutionContract,
                styleExecutionContractV2,
                referenceDesignContract,
                gradientDisciplineContract,
                "Layout contract: readable title block, capability stack panel, documentation/proof card, reliability card, and a quality/export process belt.",
                "Background safety: do not use hard-split linear-gradient backgrounds such as dark 34% then light 34%; use one continuous background plus deliberate dark panels and white cards.",
                "Contrast safety: every heading on dark panels must explicitly use white or very light color. Body text on dark panels must use rgba(255,255,255,.76+) or equivalent. Gray text may only sit on white/light surfaces.",
                "Surface rule: keep dark surfaces and light cards visually separated with spacing, not by cutting the whole section background in half.",
                "Required content: 4 capability stack items, documentation/proof list, long-term reliability note, 4-step quality/export process, and one CTA link to #contact-us.",
                "Interaction safety: CTA links must use href=\"#contact-us\". Do not output href=\"#\" or href=\"#contact\".",
                "Style rule: follow Brief JSON style_profile for mood, density, geometry, card treatment, CTA style, and palette while keeping a calm institutional About section.",
                "CSS quality: 34-72 declarations, include @media(max-width:760px), use clamp(), minmax(), grid-template-columns or auto-fit, and avoid fixed widths over 520px.",
                "Copy: English, concrete, buyer-facing, 130-230 words max. Use company/category clues from JSON.",
                "Brief JSON: " + JSON.stringify(aboutBrief)
            ].filter(Boolean).join("\n");
        }
        if (sectionKey === "contact_us") {
            const contactBrief = {
                brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
                company: schema.company_profile,
                contact: schema.contact_info,
                categories: sectionArray(schema.business_taxonomy.product_categories),
                plan: blueprint.contact_us,
                palette: designSystem.palette,
                style_profile: styleProfile,
                layout: layoutStrategy
            };
            return [
                "Generate one premium B2B industrial CONTACT US inquiry section. Return only JSON: {\"html\":\"...\"}.",
                "Speed mode: compact output. No explanations. No markdown.",
                `Required root: <section id="${sectionId}" class="ai-section contact-inquiry-section">`,
                "First child inside the section must be one scoped <style>. Every selector must start with #contact-us.",
                repairReason ? `Previous output failed validation: ${repairReason}` : "",
                userInstruction ? `User directional instruction: ${userInstruction}` : "",
                variantContract,
                paletteContract,
                styleExecutionContract,
                styleExecutionContractV2,
                referenceDesignContract,
                gradientDisciplineContract,
                "Non-negotiable conversion contract: this section must contain a real visible <form> inquiry panel. Do not replace it with cards, checklist, email links, or CTA-only content.",
                "Fixed desktop layout: left trust/CTA column, right white inquiry form panel. Mobile layout: stack left content first, form second.",
                "Left column must include: START YOUR PROJECT eyebrow, one strong heading, one concise paragraph, phone/email/location channels when available, and a short RFQ/response promise checklist.",
                "Form panel must include heading exactly Request a Free Proposal and a short subtitle.",
                "Form fields required: Your name* text input, Country text input, Email* email input, Product / project type text input, Target capacity / quantity text input, Project details textarea.",
                "Submit button text exactly SEND INQUIRY. Use #icon-send on the button when useful. Use #icon-check, #icon-phone, #icon-mail, #icon-location for support details.",
                "Style rule: follow Brief JSON style_profile for mood, density, geometry, background treatment, CTA style, and palette. The form structure is fixed, but colors, surfaces, borders, spacing, and proof-strip treatment may adapt to the style.",
                "CSS quality: 32-72 declarations, include @media(max-width:980px) and @media(max-width:640px), use clamp(), grid-template-columns, minmax(), or flex-wrap, and avoid fixed widths over 520px.",
                "Preview ratio contract: keep heading, key contact methods, and the top of the form visible in a 16:9 preview. Avoid oversized decorative graphics and avoid pushing the form below the fold on desktop.",
                "Links/forms: form action may be #contact-us and method post. No script, no external links, no CRM/login/logout/app links.",
                "Copy: English, buyer-facing, concrete, 90-170 words outside field labels. Use real company/category/contact clues from the JSON.",
                "Brief JSON: " + JSON.stringify(contactBrief)
            ].filter(Boolean).join("\n");
        }
        return [
            "Generate one premium B2B industrial website section. Return only JSON: {\"html\":\"...\"}.",
            `Section: ${sectionKey} / ${sectionLabel}`,
            `Required section id: ${sectionId}`,
            `Plan: ${blueprint[sectionKey] || ""}`,
            "Section-specific layout strategy JSON: " + JSON.stringify(layoutStrategy),
            userInstruction ? `User directional instruction: ${userInstruction}` : "",
            repairReason ? `Previous output failed validation: ${repairReason}` : "",
            variantContract,
            paletteContract,
            styleExecutionContract,
            styleExecutionContractV2,
            referenceDesignContract,
            gradientDisciplineContract,
            "Root: one fragment only. No doctype/html/head/body/script/on* handlers/CRM/login/logout/app links.",
            "Fixed framework: the page shell already provides topbar/header/footer, inline SVG sprite, .container/.ai-wrap, .ai-section, .ai-section-head, .ai-grid, .ai-card, .ai-btn, and responsive spacing. Keep those contracts but vary the section's visual language through scoped CSS.",
            "Style preference contract: treat the form style_requirements and Design system styleProfile as first-class instructions. Use its palette, mood, density, geometry, background treatment, CTA style, custom notes, keywords, and avoid list. Do not force the old navy/red industrial look unless the styleProfile actually asks for it.",
            "Use the framework as a compatibility layer, not as a visual template. Reuse icons with <svg aria-hidden=\"true\"><use href=\"#icon-arrow-right\"></use></svg>, #icon-cube, #icon-globe, #icon-check, or #icon-send.",
            `For business sections use exactly <section id="${sectionId}" class="ai-section ...">. Put one compact <style> as the first child inside that section.`,
            "CSS quality gate: include 24-64 CSS declarations, one @media rule for <=760px, and at least one of clamp(), minmax(), auto-fit, grid-template-columns, or flex-wrap.",
            `CSS scope gate: every selector must start with #${sectionId}. Do not style body/html/:root/global .container/header/footer.`,
            "Preview ratio contract: the primary editor preview is a fixed 16:9 iframe. Compose the first visible screen for a 16:9 canvas, keep key headings/CTAs inside the safe central area, avoid content that depends on extra vertical height, and prevent large decorative elements from pushing text off-canvas.",
            "Responsive contract: mobile-first. Use an inner wrapper with width:min(1440px,calc(100vw - clamp(32px,6vw,120px))) and margin:auto. Avoid fixed pixel widths over 420px, nowrap rows, or 4+ equal columns on wide screens. At 1200px+ add whitespace, line-length caps, and balanced asymmetry.",
            "Layout contract: obey the section-specific layout strategy above. Each section must use its own composition family and should not look interchangeable with Hero, Products, Applications, About, Blog, Contact, or custom pages. Do not use the common two-column split layout where text sits on the left and an image/card block sits on the right. Prefer a vertical homepage rhythm like the reference site: eyebrow/title/intro first, then a full-width visual/proof band, then stacked content groups. Product lists, specification cards, metrics, and content grids may use multi-column grids, but the whole section should read top-to-bottom.",
            `Local class naming: include the strategy family as a scoped class or class prefix inside #${sectionId}, for example ${sectionId}-${layoutStrategy.family.replace(/_/g, "-")}.`,
            "WordPress block contract: this section will become one reusable WP block/template part. Keep markup semantic, shallow, self-contained, and easy to convert to block attributes. Prefix local classes with the section key while keeping shared classes such as ai-section/ai-wrap/ai-card/ai-btn.",
            `Visual: follow this style profile summary: ${styleProfile.summary}. Keep all sections globally consistent through the same palette and typography scale, but each section must use a different composition family and surface treatment.`,
            styleProfile.avoid.length ? `Avoid from style profile: ${styleProfile.avoid.join("; ")}.` : "",
            "Wide-screen fit: at 1440-1920px avoid crowded equal columns. Use max-width text blocks, minmax grids, asymmetry, row gaps, and internal spacing so elements breathe instead of squeezing together.",
            "Copy: English, concrete, buyer-facing, no filler. 120-220 words max. Use real product/category clues from JSON.",
            userInstruction ? "Instruction priority: follow the user directional instruction when it does not violate safety, scoped CSS, responsive, fixed route, or WordPress block constraints." : "",
            "Design system JSON: " + JSON.stringify(designSystem),
            "Company form JSON: " + JSON.stringify(schema)
        ].filter(Boolean).join("\n");
    }
    function aiSiteGenerationFailure(error) {
        const raw = error instanceof Error ? error.message : "AI section generation failed";
        const timeout = /abort|timed out|timeout/i.test(raw);
        const validation = /HTML|JSON|fragment|empty|CRM/i.test(raw);
        return {
            status: timeout ? 504 : validation ? 422 : 502,
            message: timeout
                ? "AI生成超时：模型在100秒内没有完成输出，请稍后重试或缩短该区块要求。"
                : validation
                    ? `AI输出格式异常：${raw}`
                    : `AI生成失败：${raw}`
        };
    }
    async function generateAiSiteSectionHtml(project, sectionKey, user, userInstruction = "") {
        if (aiSiteLockedSections.has(sectionKey))
            return defaultAiSectionHtml(sectionKey, project, true);
        if (process.env.NODE_ENV === "test")
            return defaultAiSectionHtml(sectionKey, project, true);
        const settings = getStore().aiSiteBuilderSettings.find((item) => item.ownerId === user.id);
        if (!aiSiteModelReady(settings))
            throw new Error("AI site builder model settings are not ready. Please save and test the API settings first.");
        await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
        const config = aiSiteSettingsToModelConfig(settings);
        const effectiveInstruction = sectionKey === "hero" && !userInstruction.trim()
            ? "Refresh the Hero according to the current project theme colors. Use the current palette visibly in the overlay, badge, CTA, arrow controls, and micro accents while keeping the 72vh photo hero contract."
            : userInstruction;
        const generatedContent = await callAiModel(config, buildAiSiteSectionPrompt(project, sectionKey, "", effectiveInstruction), 9000);
        try {
            const html = aiSiteHtmlFromModelOutput(generatedContent, sectionKey);
            validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
            return html;
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : "Generated HTML failed validation";
            const repaired = await callAiModel(config, buildAiSiteSectionPrompt(project, sectionKey, reason, effectiveInstruction), 9000);
            const html = aiSiteHtmlFromModelOutput(repaired, sectionKey);
            validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
            return html;
        }
        if (!aiSiteModelReady(settings))
            throw new Error("请先在 AI建站 中完成接口设置与大模型检查");
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
        const blueprint = cleanAiSiteBlueprint(project);
        const prompt = [
            "你是跨境 B2B 工业独立站区块生成 Agent。",
            "只输出一个可被 JSON.parse 解析的 JSON 对象，格式：{\"html\":\"...\"}。",
            "html 字段必须是单个 HTML 片段，禁止 <!doctype>、<html>、<head>、<body>、<script>、内联事件、CRM 系统内容。",
            `当前区块 key：${sectionKey}`,
            `当前区块名称：${aiSiteSectionLabel(sectionKey)}`,
            `区块蓝图：${blueprint[sectionKey] || ""}`,
            "固定 CSS 类可使用：container, eyebrow, hero, grid, card, primary-btn, ghost-btn, placeholder。",
            "要求：英文站点文案，面向跨境 B2B 工业采购商；内容具体、可信、可转化；不要写中文解释。",
            `企业表单 JSON：${JSON.stringify(schema)}`
        ].join("\n");
        void prompt;
        const generationPrompt = [
            "Generate one premium B2B industrial website section. Return only JSON: {\"html\":\"...\"}.",
            `Section: ${sectionKey} / ${aiSiteSectionLabel(sectionKey)}`,
            `Plan: ${blueprint[sectionKey] || ""}`,
            "Root: one fragment only. No doctype/html/head/body/script/on* handlers/CRM/login/logout/app links.",
            "For business sections use <section id=\"kebab-section-key\">. Put one compact <style> as the first child.",
            "CSS: scoped selectors only, e.g. #products .metric. Never style html/body/:root/global tags/header/footer. Keep CSS punchy: 36-64 declarations, no reset, no giant framework.",
            "Responsive contract: mobile-first. Every section needs an inner wrapper like #products .products-wrap with width:min(1440px,calc(100vw - clamp(32px,6vw,120px))) and margin:auto. Use clamp() for section padding, gaps, and headings. Use grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr)) or explicit 2-column grids that collapse at 760px. Do not use fixed pixel widths over 420px, nowrap rows, or 4+ equal columns on wide screens. At 1200px+ add whitespace, line-length caps, and balanced asymmetry instead of squeezing everything together.",
            "WordPress block contract: this section will become one reusable WP block/template part. Keep markup semantic, shallow, self-contained, and easy to convert to block attributes. Avoid relying on sibling sections or global .container behavior. Prefix local classes with the section key and avoid duplicate generic names.",
            "Visual: bold industrial editorial, asymmetric but balanced layout, high contrast, technical pattern/detail, strong type hierarchy, proof metrics/specs/CTA. Avoid plain three-card grids unless transformed.",
            "Copy: English, concrete, buyer-facing, no filler. 120-220 words max. Use real product/category clues from JSON.",
            "Export note: this fragment and its scoped <style> will be merged with other sections, so avoid duplicate global names.",
            `Company form JSON: ${JSON.stringify(schema)}`
        ].join("\n");
        const content = await callAiModel(aiSiteSettingsToModelConfig(settings), generationPrompt, 9000);
        return aiSiteHtmlFromModelOutput(content, sectionKey);
    }
    function aiSiteSelectedRegionContext(value, maxLength = 60000) {
        return String(value || "")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
            .slice(0, maxLength)
            .trim();
    }
    function buildAiSiteSelectedRegionRewritePrompt(project, sectionKey, currentHtml, selectedRegion, userInstruction, repairReason = "") {
        const schema = normalizeAiSiteSchemaData(project.schemaData);
        const designSystem = aiSiteDesignSystem(project);
        const styleProfile = designSystem.styleProfile;
        const blueprint = cleanAiSiteBlueprint(project);
        const sectionId = sectionKey === "hero" ? "home" : sectionKey.replace(/_/g, "-");
        const selectedContext = {
            selectorPath: aiSiteSelectedRegionContext(selectedRegion.selectorPath, 1200),
            tagName: aiSiteSelectedRegionContext(selectedRegion.tagName, 80),
            id: aiSiteSelectedRegionContext(selectedRegion.id, 160),
            className: aiSiteSelectedRegionContext(selectedRegion.className, 500),
            text: aiSiteSelectedRegionContext(selectedRegion.text, 3000),
            html: aiSiteSelectedRegionContext(selectedRegion.html, 12000)
        };
        return [
            "You are the selected-region rewrite agent for a componentized B2B WordPress-ready website builder.",
            "Return only JSON: {\"html\":\"...\"}.",
            `Project section: ${sectionKey} / required section id: ${sectionId}`,
            `Section blueprint: ${blueprint[sectionKey] || ""}`,
            repairReason ? `Previous output failed validation: ${repairReason}` : "",
            "Non-negotiable technical constraints: return one full section HTML fragment, no doctype/html/head/body/script/on* handlers/CRM/login/logout/app links. Keep one scoped <style> as the first child inside the section.",
            `CSS scope gate: every selector must start with #${sectionId}. Do not style body/html/:root/global .container/header/footer. Keep responsive @media <=760px support.`,
            "WordPress block contract: semantic, shallow, self-contained markup that can become one block/template part. Preserve data hooks, CPT-facing classes, product/application/blog structures, and form controls unless the user explicitly asks to change that exact selected element.",
            "Priority order: 1) safety, scoped CSS, responsive, fixed-route, and WordPress constraints; 2) the user's selected-region instruction; 3) global style consistency from the design system and form style requirements; 4) the existing section rhythm and surrounding content.",
            "Rewrite scope: the user selected one DOM region. Modify that selected region and only the scoped CSS needed to integrate it. Preserve unrelated copy, cards, forms, hooks, and layout structures as much as possible.",
            "Style consistency: keep palette, typography scale, radius, spacing rhythm, and component density aligned with the whole page. User requested changes may override local color/layout choices, but do not create a visually unrelated section.",
            `Style profile summary: ${styleProfile.summary}. Avoid: ${(styleProfile.avoid || []).join("; ") || "none"}.`,
            "User selected-region instruction: " + userInstruction,
            "Current full section HTML to rewrite. Treat this as the source of truth and return the entire updated section: \n" + currentHtml.slice(0, 26000),
            "Selected region context JSON. This is the intended edit focus, not a replacement source by itself: " + JSON.stringify(selectedContext),
            "Design system JSON: " + JSON.stringify(designSystem),
            "Company form JSON: " + JSON.stringify(schema)
        ].filter(Boolean).join("\n");
    }
    async function rewriteAiSiteSelectedRegionHtml(project, sectionKey, user, selectedRegion, userInstruction) {
        if (aiSiteLockedSections.has(sectionKey))
            throw new Error("Locked header/footer sections cannot be rewritten through selected-region editing.");
        const currentFile = aiSectionFile(project.id, sectionKey);
        const customPages = await readAiSiteCustomPages(project);
        const currentHtml = (await fileExists(currentFile))
            ? await readFile(currentFile, "utf8")
            : defaultAiSectionHtml(sectionKey, project, false, customPages);
        if (process.env.NODE_ENV === "test")
            return currentHtml;
        const settings = getStore().aiSiteBuilderSettings.find((item) => item.ownerId === user.id);
        if (!aiSiteModelReady(settings))
            throw new Error("AI site builder model settings are not ready. Please save and test the API settings first.");
        const config = aiSiteSettingsToModelConfig(settings);
        const first = await callAiModel(config, buildAiSiteSelectedRegionRewritePrompt(project, sectionKey, currentHtml, selectedRegion, userInstruction), 42000);
        try {
            const html = aiSiteHtmlFromModelOutput(first, sectionKey);
            validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
            return html;
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : "Selected-region rewrite failed validation";
            const repaired = await callAiModel(config, buildAiSiteSelectedRegionRewritePrompt(project, sectionKey, currentHtml, selectedRegion, userInstruction, reason), 42000);
            const html = aiSiteHtmlFromModelOutput(repaired, sectionKey);
            validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
            return html;
        }
    }
    function maskedKey(value) {
        return value ? `****${value.slice(-4)}` : "";
    }
    function publicAiSiteBuilderSettings(user) {
        const existing = getStore().aiSiteBuilderSettings.find((item) => item.ownerId === user.id);
        const synced = existing || (getAiConfig(user) ? aiSiteSettingFromAiConfig(getAiConfig(user), user) : null);
        const preset = aiSiteModelPresets[0];
        const settings = synced || {
            ownerId: user.id,
            teamId: user.teamId,
            provider: preset.provider,
            model: preset.model,
            baseUrl: preset.baseUrl,
            apiKey: "",
            enabled: false,
            lastTestStatus: "untested",
            lastTestMessage: "未检查",
            updatedAt: new Date().toISOString()
        };
        return {
            provider: settings.provider,
            model: settings.model,
            baseUrl: settings.baseUrl,
            enabled: settings.enabled,
            hasApiKey: Boolean(settings.apiKey),
            maskedApiKey: maskedKey(settings.apiKey),
            lastTestStatus: normalizeAiTestStatus(settings.lastTestStatus),
            lastTestMessage: settings.lastTestMessage,
            updatedAt: settings.updatedAt
        };
    }
    app.get("/api/ai-site-builder/capabilities", requireAuth, (req, res) => {
        res.json({
            status: "reserved",
            message: "AI建站接口已预留，当前仅创建草稿，不执行真实生成或发布。",
            scope: req.user?.role === "sales" ? "personal" : req.user?.role === "manager" ? "team" : "global",
            capabilities: ["需求结构化", "页面规划", "内容生成预留", "预览发布预留"],
            defaultPages: ["首页", "产品中心", "解决方案", "成功案例", "联系我们"],
            phases: [
                { key: "brief", label: "需求收集" },
                { key: "plan", label: "站点规划" },
                { key: "generate", label: "AI生成预留" },
                { key: "publish", label: "预览发布预留" }
            ]
        });
    });
    app.get("/api/ai-site-builder/models", requireAuth, (_req, res) => {
        res.json({ providers: aiSiteModelPresets });
    });
    app.get("/api/ai-site-builder/settings", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        res.json({ settings: publicAiSiteBuilderSettings(req.user) });
    }));
    app.post("/api/ai-site-builder/settings", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const schema = z.object({
            provider: z.string().min(1).max(60).default("openai"),
            model: z.string().max(120).default(""),
            baseUrl: z.string().max(240).default(""),
            apiKey: z.string().max(500).optional().default(""),
            enabled: z.boolean().default(false)
        });
        const body = schema.parse(req.body);
        const store = getStore();
        const preset = aiSiteModelPresets.find((item) => item.provider === body.provider);
        const index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === req.user.id);
        const previous = index >= 0 ? store.aiSiteBuilderSettings[index] : null;
        const next = {
            ownerId: req.user.id,
            teamId: req.user.teamId,
            provider: body.provider,
            model: body.model || preset?.model || "",
            baseUrl: body.baseUrl || preset?.baseUrl || "",
            apiKey: body.apiKey && !body.apiKey.includes("****") ? body.apiKey : previous?.apiKey || "",
            enabled: body.enabled,
            lastTestStatus: previous?.lastTestStatus || "untested",
            lastTestMessage: previous?.lastTestMessage || "未检查",
            updatedAt: new Date().toISOString()
        };
        if (index >= 0)
            store.aiSiteBuilderSettings[index] = next;
        else
            store.aiSiteBuilderSettings.push(next);
        upsertAiConfigFromAiSiteSetting(next);
        await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
        await store.persist();
        res.json({ settings: publicAiSiteBuilderSettings(req.user) });
    }));
    app.post("/api/ai-site-builder/settings/test", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const schema = z.object({
            provider: z.string().min(1).max(60).optional(),
            model: z.string().max(120).optional(),
            baseUrl: z.string().max(240).optional(),
            apiKey: z.string().max(500).optional(),
            enabled: z.boolean().optional()
        });
        const body = schema.parse(req.body || {});
        const store = getStore();
        let index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === req.user.id);
        if (index < 0) {
            const preset = aiSiteModelPresets.find((item) => item.provider === body.provider) || aiSiteModelPresets[0];
            store.aiSiteBuilderSettings.push({
                ownerId: req.user.id,
                teamId: req.user.teamId,
                provider: body.provider || preset.provider,
                model: body.model || preset.model,
                baseUrl: body.baseUrl || preset.baseUrl,
                apiKey: body.apiKey || "",
                enabled: body.enabled ?? false,
                lastTestStatus: "untested",
                lastTestMessage: "未检查",
                updatedAt: new Date().toISOString()
            });
            index = store.aiSiteBuilderSettings.length - 1;
        }
        const settings = store.aiSiteBuilderSettings[index];
        const preset = aiSiteModelPresets.find((item) => item.provider === (body.provider || settings.provider));
        settings.provider = body.provider || settings.provider;
        settings.model = body.model || settings.model || preset?.model || "";
        settings.baseUrl = body.baseUrl || settings.baseUrl || preset?.baseUrl || "";
        settings.apiKey = body.apiKey && !body.apiKey.includes("****") ? body.apiKey : settings.apiKey;
        settings.enabled = body.enabled ?? settings.enabled;
        const result = await testAiSiteBuilderModel(settings);
        settings.lastTestStatus = result.ok ? "passed" : "failed";
        settings.lastTestMessage = result.message;
        settings.updatedAt = new Date().toISOString();
        const mirrored = upsertAiConfigFromAiSiteSetting(settings);
        mirrored.lastTestAt = new Date().toISOString();
        mirrored.lastTestStatus = normalizeAiTestStatus(settings.lastTestStatus);
        mirrored.lastTestMessage = settings.lastTestMessage;
        mirrored.updatedAt = settings.updatedAt;
        await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
        await store.persist();
        res.json({ ok: result.ok, message: settings.lastTestMessage, settings: publicAiSiteBuilderSettings(req.user) });
    }));
    app.get("/api/ai-site-builder/projects", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        res.json({
            projects: getStore().aiSiteBuilderProjects.filter((project) => canSeeAiSiteProject(req.user, project)),
            message: "项目列表接口已预留；接入持久化后将按账号数据范围返回建站项目。"
        });
    }));
    app.get("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        res.json({ project });
    }));
    app.get("/api/ai-site-builder/projects/:id/reference-sites", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const references = await readAiSiteReferenceSites(project);
        res.json({ references });
    }));
    app.post("/api/ai-site-builder/projects/:id/reference-sites/analyze", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const schema = z.object({
            urls: z.union([z.array(z.string().max(500)), z.string().max(2000)]).optional()
        });
        const body = schema.parse(req.body || {});
        const schemaData = normalizeAiSiteSchemaData(project.schemaData);
        const urls = normalizedAiReferenceUrls(body.urls === undefined ? schemaData.style_requirements.reference_sites : body.urls);
        if (!urls.length) {
            const empty = await writeAiSiteReferenceSites(project, []);
            await getStore().persist();
            res.json({ ok: true, references: empty, message: "No reference websites were provided." });
            return;
        }
        schemaData.style_requirements.reference_sites = urls;
        project.schemaData = schemaData;
        project.agentPayload = normalizeAgentPayload(project.agentPayload, schemaData, project.pages || []);
        const sites = await Promise.all(urls.map((url) => analyzeAiSiteReferenceUrl(url)));
        const references = await writeAiSiteReferenceSites(project, sites);
        await writeFile(path.join(aiProjectDir(project.id), "form.json"), JSON.stringify(project.schemaData || {}, null, 2), "utf8");
        await getStore().persist();
        res.json({
            ok: sites.some((site) => site.status === "ready"),
            references,
            message: `Reference analysis finished: ${sites.filter((site) => site.status === "ready").length}/${sites.length} ready`
        });
    }));
    app.patch("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const schema = z.object({
            taskName: z.string().max(120).optional(),
            siteName: z.string().max(120).optional(),
            industry: z.string().max(120).optional(),
            goal: z.enum(["lead-generation", "brand", "catalog", "support"]).optional(),
            tone: z.string().max(80).optional(),
            pages: z.array(z.string().min(1).max(40)).max(12).optional(),
            schemaData: z.unknown().optional(),
            agentPayload: z.unknown().optional()
        });
        const body = schema.parse(req.body || {});
        const schemaData = body.schemaData === undefined ? normalizeAiSiteSchemaData(project.schemaData) : normalizeAiSiteSchemaData(body.schemaData);
        const pages = body.pages?.length ? body.pages : project.pages?.length ? project.pages : ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
        const company = schemaData.company_profile;
        const taxonomy = schemaData.business_taxonomy;
        project.schemaData = schemaData;
        project.pages = pages;
        project.taskName = body.taskName || project.taskName || `${company.legal_name || company.wordmark || "未命名网站"} 建站任务`;
        project.siteName = body.siteName || company.legal_name || company.wordmark || project.siteName || "未命名网站";
        project.industry = body.industry || taxonomy.product_categories[0] || project.industry || "未指定行业";
        project.goal = body.goal || project.goal || "lead-generation";
        project.tone = body.tone || schemaData.style_requirements.preset || project.tone || "industrial-professional";
        project.agentPayload = normalizeAgentPayload(body.agentPayload, schemaData, pages);
        await ensureAiSiteSandbox(project);
        await writeFile(path.join(aiProjectDir(project.id), "blueprint.json"), JSON.stringify(cleanAiSiteBlueprint(project), null, 2), "utf8");
        await getStore().persist();
        res.json({ project });
    }));
    app.delete("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const store = getStore();
        const index = store.aiSiteBuilderProjects.findIndex((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (index < 0) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const [project] = store.aiSiteBuilderProjects.splice(index, 1);
        await rm(aiProjectDir(project.id), { recursive: true, force: true });
        await store.persist();
        res.json({ ok: true, id: project.id });
    }));
    app.get("/api/ai-site-builder/projects/:id/editor", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        await ensureAiSiteSandbox(project);
        const order = await readAiSiteOrder(project);
        const customPages = await readAiSiteCustomPages(project);
        const blueprintRaw = await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
        const blueprint = JSON.parse(blueprintRaw || "{}");
        const sections = await Promise.all(order.map(async (key) => {
            const exists = await fileExists(aiSectionFile(project.id, key));
            const html = exists ? await readFile(aiSectionFile(project.id, key), "utf8").catch(() => "") : "";
            let generated = exists;
            if (exists && !aiSiteLockedSections.has(key)) {
                try {
                    validateGeneratedAiSiteSectionHtml(html, key, project);
                }
                catch {
                    generated = false;
                }
            }
            return {
                key,
                label: aiSiteSectionLabel(key, customPages),
                locked: aiSiteLockedSections.has(key),
                generated,
                blueprint: aiSiteSectionBlueprint(key, blueprint, customPages)
            };
        }));
        const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
        const sectionStatus = new Map(sections.map((section) => [section.key, section.locked ? "locked" : section.generated ? "html_ready" : "blueprint"]));
        wpMetadata.sections = wpMetadata.sections.map((section) => ({
            ...section,
            status: sectionStatus.get(section.section_key) || section.status
        }));
        wpMetadata.updated_at = new Date().toISOString();
        await writeAiSiteWpMetadata(wpMetadata);
        const wpSectionMap = new Map(wpMetadata.sections.map((section) => [section.section_key, section]));
        res.json({ project, order, sections: sections.map((section) => ({ ...section, wp: wpSectionMap.get(section.key) })), blueprint, wpMetadata });
    }));
    app.patch("/api/ai-site-builder/projects/:id/editor/order", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const schema = z.object({ order: z.array(z.string()).default([]) });
        const body = schema.parse(req.body || {});
        const order = await writeAiSiteOrder(project, body.order);
        const customPages = await readAiSiteCustomPages(project);
        await readAiSiteWpMetadata(project, order, customPages);
        res.json({ order });
    }));
    app.post("/api/ai-site-builder/projects/:id/editor/pages", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const schema = z.object({ title: z.string().max(80).optional().default("") });
        const body = schema.parse(req.body || {});
        await ensureAiSiteSandbox(project);
        const customPages = await readAiSiteCustomPages(project);
        const label = cleanAiSiteCustomPageLabel(body.title, `New Page ${customPages.length + 1}`);
        let key = `custom_${Date.now().toString(36)}`;
        while (customPages.some((item) => item.key === key) || (await fileExists(aiSectionFile(project.id, key)))) {
            key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        }
        const nextCustomPages = [...customPages, { key, label, createdAt: new Date().toISOString() }];
        await writeAiSiteCustomPages(project, nextCustomPages);
        const blueprintPath = path.join(aiProjectDir(project.id), "blueprint.json");
        const blueprint = await readJsonFile(blueprintPath, cleanAiSiteBlueprint(project));
        blueprint[key] = `Custom page: ${label}. Start from a simple editable page section, then let the agent rewrite it with page-specific B2B industrial content when needed.`;
        delete blueprint.project_cases;
        await writeFile(blueprintPath, JSON.stringify(blueprint, null, 2), "utf8");
        const currentOrder = await readAiSiteOrder(project);
        const insertAt = Math.max(1, currentOrder.length - 1);
        const nextOrder = await writeAiSiteOrder(project, [...currentOrder.slice(0, insertAt), key, ...currentOrder.slice(insertAt)]);
        await writeFile(aiSectionFile(project.id, key), defaultAiSectionHtml(key, project, false, nextCustomPages), "utf8");
        const wpMetadata = await readAiSiteWpMetadata(project, nextOrder, nextCustomPages);
        res.json({ key, label, order: nextOrder, wpMetadata, message: `${label} page added` });
    }));
    app.get("/api/ai-site-builder/projects/:id/wp-rebuild", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const result = await inspectAiSiteWpRebuild(project);
        res.json(result);
    }));
    app.post("/api/ai-site-builder/projects/:id/wp-rebuild/check", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const result = await inspectAiSiteWpRebuild(project);
        res.json(result);
    }));
    app.post("/api/ai-site-builder/projects/:id/wp-rebuild/export", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const result = await exportAiSiteWpRebuildPackage(project);
        res.json(result);
    }));
    app.post("/api/ai-site-builder/projects/:id/wp-rebuild/install", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "AI site project was not found or is not accessible." });
            return;
        }
        const schema = z.object({
            wordpressRoot: z.string().min(1).max(500),
            themeSlug: z.string().max(80).optional(),
            overwrite: z.boolean().optional().default(false)
        });
        const body = schema.parse(req.body || {});
        const result = await installAiSiteWpRebuildPackage(project, body.wordpressRoot, body.themeSlug, body.overwrite);
        res.json(result);
    }));
    app.get("/api/ai-site-builder/projects/:id/sections/:sectionKey", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        const sectionKey = req.params.sectionKey;
        if (!project || !isAiSiteSectionKey(sectionKey)) {
            res.status(404).json({ message: "区块不存在或无权访问" });
            return;
        }
        await ensureAiSiteSandbox(project);
        const customPages = await readAiSiteCustomPages(project);
        const file = aiSectionFile(project.id, sectionKey);
        const designSystem = aiSiteDesignSystem(project);
        if (!(await fileExists(file)) && !aiSiteLockedSections.has(sectionKey)) {
            res.json({ sectionKey, html: defaultAiSectionHtml(sectionKey, project, false, customPages), generated: false, designSystem });
            return;
        }
        const html = await readFile(file, "utf8");
        let generated = true;
        if (!aiSiteLockedSections.has(sectionKey)) {
            try {
                validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
            }
            catch {
                generated = false;
            }
        }
        res.json({ sectionKey, html, generated, designSystem });
    }));
    app.put("/api/ai-site-builder/projects/:id/sections/:sectionKey", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        const sectionKey = req.params.sectionKey;
        if (!project || !isAiSiteSectionKey(sectionKey)) {
            res.status(404).json({ message: "区块不存在或无权访问" });
            return;
        }
        const schema = z.object({ html: z.string().max(200000).default("") });
        const body = schema.parse(req.body || {});
        await ensureAiSiteSandbox(project);
        await writeAiSiteSectionHtml(project, sectionKey, body.html || defaultAiSectionHtml(sectionKey, project, true), "source-save");
        let generated = true;
        if (!aiSiteLockedSections.has(sectionKey)) {
            try {
                validateGeneratedAiSiteSectionHtml(body.html || "", sectionKey, project);
            }
            catch {
                generated = false;
            }
        }
        res.json({ sectionKey, html: body.html, generated });
    }));
    app.post("/api/ai-site-builder/projects/:id/sections/:sectionKey/undo", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        const sectionKey = req.params.sectionKey;
        if (!project || !isAiSiteSectionKey(sectionKey)) {
            res.status(404).json({ message: "Section was not found or is not accessible" });
            return;
        }
        await ensureAiSiteSandbox(project);
        try {
            const result = await undoAiSiteSectionHtml(project, sectionKey);
            let generated = true;
            if (!aiSiteLockedSections.has(sectionKey)) {
                try {
                    validateGeneratedAiSiteSectionHtml(result.html, sectionKey, project);
                }
                catch {
                    generated = false;
                }
            }
            res.json({
                ok: true,
                sectionKey,
                html: result.html,
                generated,
                revision: result.revision,
                message: `${aiSiteSectionLabel(sectionKey)} restored from the latest undo snapshot`
            });
        }
        catch (error) {
            res.status(404).json({
                ok: false,
                sectionKey,
                message: error instanceof Error ? error.message : "No undo snapshot is available for this section."
            });
        }
    }));
    app.post("/api/ai-site-builder/projects/:id/sections/:sectionKey/selected-region/rewrite", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        const sectionKey = req.params.sectionKey;
        if (!project || !isAiSiteSectionKey(sectionKey)) {
            res.status(404).json({ message: "Section was not found or is not accessible" });
            return;
        }
        if (aiSiteLockedSections.has(sectionKey)) {
            res.status(400).json({ message: "Header/Footer are locked global components. Use the theme refresh action instead." });
            return;
        }
        const schema = z.object({
            instruction: z.string().min(1).max(1200),
            selectedRegion: z.object({
                selectorPath: z.string().min(1).max(1200),
                tagName: z.string().max(80).optional().default(""),
                id: z.string().max(160).optional().default(""),
                className: z.string().max(500).optional().default(""),
                text: z.string().max(3000).optional().default(""),
                html: z.string().min(1).max(70000)
            }).passthrough()
        });
        const body = schema.parse(req.body || {});
        await ensureAiSiteSandbox(project);
        try {
            const html = await rewriteAiSiteSelectedRegionHtml(project, sectionKey, req.user, body.selectedRegion, body.instruction.trim());
            await writeAiSiteSectionHtml(project, sectionKey, html, "selected-region-rewrite");
            res.json({
                ok: true,
                sectionKey,
                html,
                generated: true,
                message: `${aiSiteSectionLabel(sectionKey)} selected region rewritten and written to local HTML fragment`,
                progress: [
                    `${aiSiteSectionLabel(sectionKey)} selected region rewrite complete`,
                    "Full section HTML was refreshed so scoped CSS and responsive layout remain consistent."
                ]
            });
        }
        catch (error) {
            const failure = aiSiteGenerationFailure(error);
            res.status(failure.status).json({
                ok: false,
                sectionKey,
                generated: false,
                message: failure.message,
                progress: [`${aiSiteSectionLabel(sectionKey)} selected region rewrite failed`, failure.message]
            });
        }
    }));
    app.post("/api/ai-site-builder/projects/:id/sections/:sectionKey/generate", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        const sectionKey = req.params.sectionKey;
        if (!project || !isAiSiteSectionKey(sectionKey)) {
            res.status(404).json({ message: "区块不存在或无权访问" });
            return;
        }
        const schema = z.object({ instruction: z.string().max(1200).optional().default("") });
        const body = schema.parse(req.body || {});
        await ensureAiSiteSandbox(project);
        if (aiSiteLockedSections.has(sectionKey)) {
            const palette = refreshAiSiteProjectThemePalette(project);
            const headerHtml = defaultAiSectionHtml("header", project, true);
            const footerHtml = defaultAiSectionHtml("footer", project, true);
            await writeAiSiteSectionHtml(project, "header", headerHtml, "theme-refresh");
            await writeAiSiteSectionHtml(project, "footer", footerHtml, "theme-refresh");
            await writeFile(aiProjectMetaFile(project.id), JSON.stringify(project, null, 2), "utf8");
            await writeFile(path.join(aiProjectDir(project.id), "form.json"), JSON.stringify(project.schemaData || {}, null, 2), "utf8");
            await writeFile(aiSiteDesignSystemFile(project.id), JSON.stringify(aiSiteDesignSystem(project), null, 2), "utf8");
            await getStore().persist();
            const html = sectionKey === "header" ? headerHtml : footerHtml;
            res.json({
                sectionKey,
                html,
                generated: true,
                changed: true,
                palette,
                message: `${aiSiteSectionLabel(sectionKey)} theme colors refreshed`
            });
            return;
        }
        try {
            const html = await generateAiSiteSectionHtml(project, sectionKey, req.user, body.instruction.trim());
            await writeAiSiteSectionHtml(project, sectionKey, html, "section-generate");
            res.json({ sectionKey, html, generated: true, message: `${aiSiteSectionLabel(sectionKey)} generated and written to local HTML fragment` });
        }
        catch (error) {
            const failure = aiSiteGenerationFailure(error);
            res.status(failure.status).json({
                ok: false,
                sectionKey,
                generated: false,
                message: failure.message,
                progress: [`${aiSiteSectionLabel(sectionKey)} generation failed`, failure.message]
            });
        }
    }));
    app.post("/api/ai-site-builder/projects/:id/sections/generate-batch", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const schema = z.object({ order: z.array(z.string()).default([]) });
        const body = schema.parse(req.body || {});
        await ensureAiSiteSandbox(project);
        const savedOrder = body.order.length ? await writeAiSiteOrder(project, body.order) : await readAiSiteOrder(project);
        const targets = savedOrder.filter((key) => !aiSiteLockedSections.has(key));
        const results = [];
        for (const sectionKey of targets) {
            try {
                const html = await generateAiSiteSectionHtml(project, sectionKey, req.user);
                await writeAiSiteSectionHtml(project, sectionKey, html, "batch-generate");
                results.push({ sectionKey, label: aiSiteSectionLabel(sectionKey), ok: true, message: "已生成" });
            }
            catch (error) {
                results.push({
                    sectionKey,
                    label: aiSiteSectionLabel(sectionKey),
                    ok: false,
                    message: error instanceof Error ? error.message : "生成失败，已保留旧片段"
                });
            }
        }
        res.json({
            ok: results.every((item) => item.ok),
            generatedCount: results.filter((item) => item.ok).length,
            failedCount: results.filter((item) => !item.ok).length,
            results,
            message: `批量生成完成：成功 ${results.filter((item) => item.ok).length} 个，失败 ${results.filter((item) => !item.ok).length} 个`
        });
    }));
    app.get("/api/ai-site-builder/projects/:id/export", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "寤虹珯椤圭洰浠诲姟涓嶅瓨鍦ㄦ垨鏃犳潈璁块棶" });
            return;
        }
        const includeHtml = String(req.query.html || "").toLowerCase() === "true";
        const exportState = await readAiSiteProjectExport(project, includeHtml);
        res.json(exportState);
    }));
    app.post("/api/ai-site-builder/projects/:id/export", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user, item));
        if (!project) {
            res.status(404).json({ message: "建站项目任务不存在或无权访问" });
            return;
        }
        const schema = z.object({ order: z.array(z.string()).default([]) });
        const body = schema.parse(req.body || {});
        const exportResult = await exportAiSiteProject(project, body.order);
        res.json({
            ok: true,
            export: exportResult,
            message: `整站已导出：${exportResult.indexPath}`
        });
    }));
    app.post("/api/ai-site-builder/projects", requireAuth, asyncRoute(async (req, res) => {
        await hydrateAiSiteLocalState(req.user);
        const schema = z.object({
            taskName: z.string().max(120).optional().default("官网建站任务"),
            siteName: z.string().max(120).optional().default(""),
            industry: z.string().max(120).optional().default(""),
            goal: z.enum(["lead-generation", "brand", "catalog", "support"]).default("lead-generation"),
            tone: z.string().max(80).default("professional"),
            pages: z.array(z.string().min(1).max(40)).max(12).default([]),
            brief: z.string().max(1200).default(""),
            schemaData: z.unknown().optional(),
            agentPayload: z.unknown().optional()
        });
        const body = schema.parse(req.body);
        const schemaData = normalizeAiSiteSchemaData(body.schemaData);
        const pages = body.pages.length ? body.pages : ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
        const agentPayload = normalizeAgentPayload(body.agentPayload, schemaData, pages);
        const company = schemaData.company_profile;
        const taxonomy = schemaData.business_taxonomy;
        const project = {
            id: `site_${Date.now()}`,
            taskName: body.taskName || "官网建站任务",
            siteName: body.siteName || company.legal_name || company.wordmark || "未命名网站",
            industry: body.industry || taxonomy.product_categories[0] || "未指定行业",
            goal: body.goal,
            tone: body.tone,
            pages,
            schemaData,
            agentPayload,
            status: "draft_reserved",
            ownerId: req.user.id,
            teamId: req.user.teamId,
            createdAt: new Date().toISOString()
        };
        const store = getStore();
        store.aiSiteBuilderProjects.unshift(project);
        await ensureAiSiteSandbox(project);
        await store.persist();
        res.status(201).json({
            project,
            nextActions: [
                "确认站点信息架构和页面范围",
                "接入AI内容生成服务",
                "接入主题/模板生成器",
                "接入预览、发布和回滚流程"
            ]
        });
    }));
}
