function normalizeJson(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeJson);
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, normalizeJson(item)]));
    }
    return value;
}
export function canonicalJsonStringify(value) {
    return JSON.stringify(normalizeJson(value));
}
