function assignToDescription(params) {
    if (Object.values(params).every((v) => !v)) {
        return undefined;
    }
    const { description, title, format, maxLength, minLength, max, min, minimum, maximum, pattern, } = params;
    return `${title
        ? `
 * ${title}
 * `
        : ""}${description
        ? `
 * ${description}`
        : ""}${format
        ? `
 * - Format: ${format}`
        : ""}${maxLength
        ? `
 * - maxLength: ${maxLength}`
        : ""}${minLength
        ? `
 * - minLength: ${minLength}`
        : ""}${min
        ? `
 * - min: ${min}`
        : ""}${max
        ? `
 * - max: ${max}`
        : ""}${minimum
        ? `
 * - minimum: ${minimum}`
        : ""}${maximum
        ? `
 * - max: ${maximum}`
        : ""}${pattern
        ? `
 * - pattern: ${pattern}`
        : ""}`;
}
function getJsdoc(doc) {
    const descriptionWithDetails = assignToDescription(doc);
    return doc.deprecated || descriptionWithDetails || doc.example
        ? `
/**${descriptionWithDetails
            ? `
 * ${normalizeDescription(descriptionWithDetails)}`
            : ""}${doc.deprecated
            ? `
 * @deprecated ${normalizeDescription(doc.deprecated) || ""}`
            : ""}${doc.example
            ? `
 * @example 
 *   ${doc.example}`
            : ""}
 */
`
        : "";
}
function normalizeDescription(str) {
    return str === null || str === void 0 ? void 0 : str.replace(/\*\//g, "*\\/");
}
export { getJsdoc };
//# sourceMappingURL=jsdoc.mjs.map