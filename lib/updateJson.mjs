import { default as chalk } from "chalk";
function partialUpdateJson(input, newJson, tag) {
    let refs = [];
    const filteredPaths = Object.fromEntries(Object.entries(input.paths).map(([name, value]) => [
        name,
        Object.fromEntries(Object.entries(value).filter(([_, { tags }]) => !(tags === null || tags === void 0 ? void 0 : tags.find((item) => tag.find((i) => i === item))))),
    ]));
    const paths = Object.assign({}, filteredPaths);
    Object.entries(newJson.paths).forEach(([endPoint, value]) => {
        Object.entries(value).forEach(([method, options]) => {
            if (typeof options !== "object") {
                return;
            }
            if (tag.find((t) => { var _a; return (_a = options.tags) === null || _a === void 0 ? void 0 : _a.includes(t); })) {
                refs = refs.concat(findRefs(options));
                if (!paths[endPoint]) {
                    paths[endPoint] = Object.assign({}, newJson.paths[endPoint]);
                }
                paths[endPoint][method] = options;
            }
        });
    });
    refs = findRelatedRef(newJson, refs);
    const components = replaceComponents(input, newJson, refs);
    return Object.assign(Object.assign({}, input), { paths,
        components });
}
function findRelatedRef(newJson, refs) {
    try {
        ["schemas", "requestBodies", "parameters"].map((key) => {
            var _a;
            if ((_a = newJson === null || newJson === void 0 ? void 0 : newJson.components) === null || _a === void 0 ? void 0 : _a[key]) {
                Object.entries(newJson.components[key]).forEach(([name, schema]) => {
                    if (refs.includes(name)) {
                        const schemaRefs = findRefs(schema);
                        const newRefs = schemaRefs.filter((ref) => !refs.includes(ref));
                        if (newRefs.length > 0) {
                            refs = findRelatedRef(newJson, [...refs, ...newRefs]);
                        }
                    }
                });
            }
        });
    }
    catch (error) {
        console.log(chalk.red(error));
    }
    return refs;
}
function replaceComponents(input, newJson, refs) {
    const components = Object.assign({}, input.components);
    ["schemas", "requestBodies", "parameters"].map((key) => {
        var _a;
        if ((_a = newJson === null || newJson === void 0 ? void 0 : newJson.components) === null || _a === void 0 ? void 0 : _a[key]) {
            Object.entries(newJson.components[key]).forEach(([name, schema]) => {
                if (refs.includes(name)) {
                    if (!components[key]) {
                        components[key] = Object.assign({}, input.components[key]);
                    }
                    components[key][name] = schema;
                }
            });
        }
    });
    return components;
}
function findRefs(obj) {
    if (typeof obj !== "object") {
        return [];
    }
    if (Array.isArray(obj)) {
        return obj.flatMap((value) => {
            return findRefs(value);
        });
    }
    return Object.entries(obj).flatMap(([key, value]) => {
        if (key === "$ref") {
            return [value.replace(/#\/components\/[\w]+\//g, "")];
        }
        return findRefs(value);
    });
}
export { partialUpdateJson };
//# sourceMappingURL=updateJson.mjs.map