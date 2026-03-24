import { getPathParams, generateServiceName, getHeaderParams, getParametersInfo, getRefName, toPascalCase, } from "./utils.mjs";
import { generateApis } from "./generateApis.mjs";
import { generateTypes } from "./generateTypes.mjs";
function generator(input, config) {
    var _a, _b, _c;
    const apis = [];
    const types = [];
    let constantsCounter = 0;
    const constants = [];
    const whitelistFilters = (config.whitelistRegex || []).map((pattern) => new RegExp(pattern));
    const includedOperations = [];
    function hasSwagger2ResponseSchema() {
        return Object.values(input.paths).some((pathItem) => Object.values(pathItem).some((value) => {
            if (!value || typeof value !== "object") {
                return false;
            }
            if (value.responses) {
                return Object.values(value.responses).some((response) => response === null || response === void 0 ? void 0 : response.schema);
            }
            return false;
        }));
    }
    function getConstantName(value) {
        const constant = constants.find((_constant) => _constant.value === value);
        if (constant) {
            return constant.name;
        }
        const name = `_CONSTANT${constantsCounter++}`;
        constants.push({
            name,
            value,
        });
        return name;
    }
    function isRequestBodyRequired(requestBody) {
        var _a, _b, _c;
        if (!requestBody) {
            return false;
        }
        if (requestBody.required === true) {
            return true;
        }
        if (!requestBody.$ref) {
            return false;
        }
        return (((_c = (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.requestBodies) === null || _b === void 0 ? void 0 : _b[getRefName(requestBody.$ref)]) === null || _c === void 0 ? void 0 : _c.required) === true);
    }
    function resolveParameter(parameter) {
        var _a, _b;
        const { $ref } = parameter;
        const resolvedParameter = $ref
            ? Object.assign(Object.assign({}, (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b[$ref.replace("#/components/parameters/", "")]), { $ref, schema: { $ref } }) : parameter;
        return resolvedParameter.in === "path"
            ? Object.assign(Object.assign({}, resolvedParameter), { required: true }) : resolvedParameter;
    }
    function mergeParameters(pathLevelParams, operationLevelParams) {
        const mergedParameters = new Map();
        [...(pathLevelParams || []), ...(operationLevelParams || [])].forEach((parameter) => {
            const resolvedParameter = resolveParameter(parameter);
            mergedParameters.set(`${resolvedParameter.in}:${resolvedParameter.name}`, resolvedParameter);
        });
        return mergedParameters.size > 0
            ? Array.from(mergedParameters.values())
            : undefined;
    }
    try {
        if (input.openapi) {
            if (input.definitions) {
                console.warn("OpenAPI 3 input contains Swagger 2 'definitions'. Fallbacks will be used.");
            }
            if (hasSwagger2ResponseSchema()) {
                console.warn("OpenAPI 3 input contains Swagger 2 'responses.schema'. Fallbacks will be used.");
            }
        }
        Object.entries(input.paths).forEach(([endPoint, value]) => {
            const parametersExtended = value.parameters;
            Object.entries(value).forEach(([method, options]) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (method === "parameters") {
                    return;
                }
                const { operationId, security } = options;
                const parameters = mergeParameters(parametersExtended, options.parameters);
                const serviceName = generateServiceName(endPoint, method, operationId, config);
                const whitelistTarget = `${method.toUpperCase()} ${endPoint}`;
                const matchesWhitelist = !whitelistFilters.length ||
                    whitelistFilters.some((regex) => [whitelistTarget, endPoint, serviceName, operationId]
                        .filter((value) => Boolean(value))
                        .some((value) => regex.test(value)));
                if (!matchesWhitelist) {
                    return;
                }
                includedOperations.push({
                    parameters,
                    requestBody: options.requestBody,
                    responses: options.responses,
                });
                const pathParams = getPathParams(parameters);
                const { exist: isQueryParamsExist, isNullable: isQueryParamsNullable, params: queryParameters, } = getParametersInfo(parameters, "query");
                const queryParamsTypeName = isQueryParamsExist
                    ? `${toPascalCase(serviceName)}QueryParams`
                    : false;
                if (queryParamsTypeName) {
                    types.push({
                        name: queryParamsTypeName,
                        schema: {
                            type: "object",
                            nullable: isQueryParamsNullable,
                            properties: queryParameters === null || queryParameters === void 0 ? void 0 : queryParameters.reduce((prev, { name, schema, $ref, required: _required, description }) => {
                                return Object.assign(Object.assign({}, prev), { [name]: Object.assign(Object.assign({}, ($ref ? { $ref } : schema)), { nullable: !_required, description }) });
                            }, {}),
                        },
                    });
                }
                const { params: headerParams, isNullable: hasNullableHeaderParams } = getHeaderParams(parameters, config);
                const requestBody = getBodyContent(options.requestBody);
                const requestBodyRequired = isRequestBodyRequired(options.requestBody);
                const contentType = Object.keys(((_a = options.requestBody) === null || _a === void 0 ? void 0 : _a.content) ||
                    (((_b = options.requestBody) === null || _b === void 0 ? void 0 : _b.$ref) &&
                        ((_e = (_d = (_c = input.components) === null || _c === void 0 ? void 0 : _c.requestBodies) === null || _d === void 0 ? void 0 : _d[getRefName(options.requestBody.$ref)]) === null || _e === void 0 ? void 0 : _e.content)) || {
                    "application/json": null,
                })[0];
                const accept = Object.keys(((_g = (_f = options.responses) === null || _f === void 0 ? void 0 : _f[200]) === null || _g === void 0 ? void 0 : _g.content) || {
                    "application/json": null,
                })[0];
                const responses = getBodyContent((_h = options.responses) === null || _h === void 0 ? void 0 : _h[200]);
                let pathParamsRefString = pathParams.reduce((prev, { name }) => `${prev}${name},`, "");
                pathParamsRefString = pathParamsRefString
                    ? `{${pathParamsRefString}}`
                    : undefined;
                const additionalAxiosConfig = headerParams
                    ? `{
              headers:{
                ...${getConstantName(`{
                  "Content-Type": "${contentType}",
                  Accept: "${accept}",

                }`)},
                ...headerParams,
              },
            }`
                    : getConstantName(`{
              headers: {
                "Content-Type": "${contentType}",
                Accept: "${accept}",
              },
            }`);
                apis.push({
                    contentType,
                    summary: options.summary,
                    deprecated: options.deprecated,
                    serviceName,
                    queryParamsTypeName,
                    pathParams,
                    requestBody,
                    requestBodyRequired,
                    headerParams,
                    isQueryParamsNullable,
                    isHeaderParamsNullable: hasNullableHeaderParams,
                    responses,
                    pathParamsRefString,
                    endPoint,
                    method: method,
                    security: security
                        ? getConstantName(JSON.stringify(security))
                        : "undefined",
                    additionalAxiosConfig,
                    queryParameters,
                });
            });
        });
        if (!whitelistFilters.length) {
            if ((_a = input === null || input === void 0 ? void 0 : input.components) === null || _a === void 0 ? void 0 : _a.schemas) {
                types.push(...Object.entries(input.components.schemas).map(([name, schema]) => {
                    return {
                        name,
                        schema,
                    };
                }));
            }
            if (input === null || input === void 0 ? void 0 : input.definitions) {
                types.push(...Object.entries(input.definitions).map(([name, schema]) => {
                    return {
                        name,
                        schema,
                    };
                }));
            }
            if ((_b = input === null || input === void 0 ? void 0 : input.components) === null || _b === void 0 ? void 0 : _b.parameters) {
                types.push(...Object.entries(input.components.parameters).map(([key, value]) => (Object.assign(Object.assign({}, value), { name: key }))));
            }
            if ((_c = input === null || input === void 0 ? void 0 : input.components) === null || _c === void 0 ? void 0 : _c.requestBodies) {
                types.push(...Object.entries(input.components.requestBodies)
                    .map(([name, _requestBody]) => {
                    var _a;
                    return {
                        name: `RequestBody${name}`,
                        schema: (_a = Object.values(_requestBody.content || {})[0]) === null || _a === void 0 ? void 0 : _a.schema,
                        description: _requestBody.description,
                    };
                })
                    .filter((v) => v.schema));
            }
        }
        else {
            const collected = collectReferencedTypes(input, includedOperations);
            collected.schemas.forEach((name) => {
                var _a, _b;
                const schema = (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.schemas) === null || _b === void 0 ? void 0 : _b[name];
                if (schema) {
                    types.push({ name, schema });
                }
            });
            collected.definitions.forEach((name) => {
                var _a;
                const schema = (_a = input.definitions) === null || _a === void 0 ? void 0 : _a[name];
                if (schema) {
                    types.push({ name, schema });
                }
            });
            collected.parameters.forEach((name) => {
                var _a, _b;
                const parameter = (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b[name];
                if (parameter) {
                    types.push(Object.assign(Object.assign({}, parameter), { name }));
                }
            });
            collected.requestBodies.forEach((name) => {
                var _a, _b, _c;
                const requestBody = (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.requestBodies) === null || _b === void 0 ? void 0 : _b[name];
                const schema = requestBody
                    ? (_c = Object.values(requestBody.content || {})[0]) === null || _c === void 0 ? void 0 : _c.schema
                    : undefined;
                if (schema) {
                    types.push({
                        name: `RequestBody${name}`,
                        schema,
                        description: requestBody === null || requestBody === void 0 ? void 0 : requestBody.description,
                    });
                }
            });
        }
        const code = generateApis(apis, types, config);
        const type = generateTypes(types, config);
        return { code, type };
    }
    catch (error) {
        console.error({ error });
        return { code: "", type: "" };
    }
}
function collectReferencedTypes(input, includedOperations) {
    var _a, _b;
    const collected = {
        schemas: new Set(),
        definitions: new Set(),
        parameters: new Set(),
        requestBodies: new Set(),
    };
    const collectRef = ($ref) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const parts = $ref.split("/");
        const category = parts[parts.length - 2];
        const name = parts[parts.length - 1];
        if (!category || !name) {
            return;
        }
        switch (category) {
            case "schemas": {
                if (collected.schemas.has(name)) {
                    return;
                }
                collected.schemas.add(name);
                collectSchema((_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.schemas) === null || _b === void 0 ? void 0 : _b[name]);
                return;
            }
            case "definitions": {
                if (collected.definitions.has(name)) {
                    return;
                }
                collected.definitions.add(name);
                collectSchema((_c = input.definitions) === null || _c === void 0 ? void 0 : _c[name]);
                return;
            }
            case "parameters": {
                if (collected.parameters.has(name)) {
                    return;
                }
                collected.parameters.add(name);
                const parameter = (_e = (_d = input.components) === null || _d === void 0 ? void 0 : _d.parameters) === null || _e === void 0 ? void 0 : _e[name];
                if (parameter === null || parameter === void 0 ? void 0 : parameter.$ref) {
                    collectRef(parameter.$ref);
                }
                collectSchema(parameter === null || parameter === void 0 ? void 0 : parameter.schema);
                return;
            }
            case "requestBodies": {
                if (collected.requestBodies.has(name)) {
                    return;
                }
                collected.requestBodies.add(name);
                const requestBody = (_g = (_f = input.components) === null || _f === void 0 ? void 0 : _f.requestBodies) === null || _g === void 0 ? void 0 : _g[name];
                if (requestBody === null || requestBody === void 0 ? void 0 : requestBody.$ref) {
                    collectRef(requestBody.$ref);
                }
                Object.values((requestBody === null || requestBody === void 0 ? void 0 : requestBody.content) || {}).forEach((mediaType) => {
                    collectSchema(mediaType.schema);
                });
                return;
            }
            case "responses": {
                const response = (_j = (_h = input.components) === null || _h === void 0 ? void 0 : _h.responses) === null || _j === void 0 ? void 0 : _j[name];
                if (!response) {
                    return;
                }
                if (response.$ref) {
                    collectRef(response.$ref);
                }
                collectSchema(response.schema);
                Object.values(response.content || {}).forEach((mediaType) => {
                    collectSchema(mediaType.schema);
                });
            }
        }
    };
    const collectSchema = (schema) => {
        var _a, _b, _c, _d;
        if (!schema || schema === true || typeof schema !== "object") {
            return;
        }
        const typedSchema = schema;
        if (typedSchema.$ref) {
            collectRef(typedSchema.$ref);
        }
        collectSchema(typedSchema.items);
        collectSchema(typedSchema.additionalProperties);
        collectSchema(typedSchema.not);
        (_a = typedSchema.allOf) === null || _a === void 0 ? void 0 : _a.forEach((value) => collectSchema(value));
        (_b = typedSchema.oneOf) === null || _b === void 0 ? void 0 : _b.forEach((value) => collectSchema(value));
        (_c = typedSchema.anyOf) === null || _c === void 0 ? void 0 : _c.forEach((value) => collectSchema(value));
        Object.values(typedSchema.properties || {}).forEach((value) => collectSchema(value));
        Object.values(((_d = typedSchema.discriminator) === null || _d === void 0 ? void 0 : _d.mapping) || {}).forEach((value) => collectRef(value));
    };
    for (const operation of includedOperations) {
        (_a = operation.parameters) === null || _a === void 0 ? void 0 : _a.forEach((parameter) => {
            if (parameter.$ref) {
                collectRef(parameter.$ref);
            }
            collectSchema(parameter.schema);
        });
        if ((_b = operation.requestBody) === null || _b === void 0 ? void 0 : _b.$ref) {
            collectRef(operation.requestBody.$ref);
        }
        collectSchema(getBodyContent(operation.requestBody));
        Object.values(operation.responses || {}).forEach((response) => {
            if (response.$ref) {
                collectRef(response.$ref);
            }
            collectSchema(response.schema);
            Object.values(response.content || {}).forEach((mediaType) => {
                collectSchema(mediaType.schema);
            });
        });
    }
    return collected;
}
function getBodyContent(responses) {
    if (!responses) {
        return responses;
    }
    return responses.content
        ? Object.values(responses.content)[0].schema
        : responses.schema
            ? responses.schema
            : responses.$ref
                ? {
                    $ref: responses.$ref,
                }
                : undefined;
}
export { generator };
//# sourceMappingURL=generator.mjs.map