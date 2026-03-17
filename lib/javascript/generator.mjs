import { getPathParams, generateServiceName, getHeaderParams, getParametersInfo, getRefName, toPascalCase, } from "./utils.mjs";
import { generateApis } from "./generateApis.mjs";
import { generateTypes } from "./generateTypes.mjs";
import { generateConstants } from "./generateConstants.mjs";
import { generateHook } from "./generateHook.mjs";
function generator(input, config) {
    const context = {
        apis: [],
        types: [],
        constants: [],
        constantsCounter: 0,
        input,
        config,
        includeFilters: (config.includes || []).map((pattern) => new RegExp(pattern)),
        excludeFilters: (config.excludes || []).map((pattern) => new RegExp(pattern)),
        whitelistFilters: (config.whitelistRegex || []).map((pattern) => new RegExp(pattern)),
        includedOperations: [],
    };
    function hasSwagger2ResponseSchema() {
        return Object.values(context.input.paths).some((pathItem) => Object.values(pathItem).some((value) => {
            if (!value || typeof value !== "object") {
                return false;
            }
            if (value.responses) {
                return Object.values(value.responses).some((response) => response === null || response === void 0 ? void 0 : response.schema);
            }
            return false;
        }));
    }
    try {
        if (context.input.openapi) {
            if (context.input.definitions) {
                console.warn("OpenAPI 3 input contains Swagger 2 'definitions'. Fallbacks will be used.");
            }
            if (hasSwagger2ResponseSchema()) {
                console.warn("OpenAPI 3 input contains Swagger 2 'responses.schema'. Fallbacks will be used.");
            }
        }
        // Process API paths
        processApiPaths(context);
        // Extract types from components
        extractComponentTypes(context);
        // Generate final code
        let code = generateApis(context.apis, context.types, config);
        code += generateConstants(context.constants);
        const type = generateTypes(context.types, config);
        const hooks = config.reactHooks
            ? generateHook(context.apis, context.types, config)
            : "";
        return { code, hooks, type };
    }
    catch (error) {
        console.error({ error });
        return { code: "", hooks: "", type: "" };
    }
}
/** Get or create a constant and return its name */
function getConstantName(context, value) {
    const existing = context.constants.find((c) => c.value === value);
    if (existing) {
        return existing.name;
    }
    const name = `_CONSTANT${context.constantsCounter++}`;
    context.constants.push({ name, value });
    return name;
}
/** Check if a method should be included based on filters */
function shouldIncludeMethod(context, serviceName, endPoint, method, operationId) {
    const whitelistTarget = `${method.toUpperCase()} ${endPoint}`;
    const matchesWhitelist = !context.whitelistFilters.length ||
        context.whitelistFilters.some((regex) => [whitelistTarget, endPoint, serviceName, operationId]
            .filter((value) => Boolean(value))
            .some((value) => regex.test(value)));
    const matchesInclude = !context.includeFilters.length ||
        context.includeFilters.some((regex) => regex.test(serviceName));
    const matchesExclude = context.excludeFilters.some((regex) => regex.test(serviceName));
    return matchesWhitelist && matchesInclude && !matchesExclude;
}
/** Resolve parameter references */
function resolveParameters(context, parameters) {
    return parameters === null || parameters === void 0 ? void 0 : parameters.map((parameter) => {
        var _a, _b;
        const { $ref } = parameter;
        if (!$ref) {
            return parameter;
        }
        const name = $ref.replace("#/components/parameters/", "");
        return Object.assign(Object.assign({}, (_b = (_a = context.input.components) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b[name]), { $ref, schema: { $ref } });
    });
}
/** Create query params type if needed */
function createQueryParamsType(context, serviceName, parameters) {
    const { exist: isQueryParamsExist, isNullable: isQueryParamsNullable, params: queryParameters, } = getParametersInfo(parameters, "query");
    if (!isQueryParamsExist) {
        return false;
    }
    const typeName = `${toPascalCase(serviceName)}QueryParams`;
    const properties = queryParameters === null || queryParameters === void 0 ? void 0 : queryParameters.reduce((prev, { name, schema, $ref, required: _required, description }) => (Object.assign(Object.assign({}, prev), { [name]: Object.assign(Object.assign({}, ($ref ? { $ref } : schema)), { nullable: !_required, description }) })), {});
    context.types.push({
        name: typeName,
        schema: {
            type: "object",
            nullable: isQueryParamsNullable,
            properties,
        },
    });
    return typeName;
}
/** Get content type from request body */
function getContentType(context, requestBody) {
    var _a, _b, _c;
    const content = (requestBody === null || requestBody === void 0 ? void 0 : requestBody.content) ||
        ((requestBody === null || requestBody === void 0 ? void 0 : requestBody.$ref) &&
            ((_c = (_b = (_a = context.input.components) === null || _a === void 0 ? void 0 : _a.requestBodies) === null || _b === void 0 ? void 0 : _b[getRefName(requestBody.$ref)]) === null || _c === void 0 ? void 0 : _c.content)) || { "application/json": null };
    return Object.keys(content)[0];
}
/** Get accept header from responses */
function getAcceptHeader(responses) {
    var _a;
    const content = ((_a = responses === null || responses === void 0 ? void 0 : responses[200]) === null || _a === void 0 ? void 0 : _a.content) || { "application/json": null };
    return Object.keys(content)[0];
}
/** Build path params reference string */
function buildPathParamsRefString(pathParams) {
    if (pathParams.length === 0) {
        return undefined;
    }
    const paramNames = pathParams.map(({ name }) => name).join(",");
    return `{${paramNames}}`;
}
/** Build Axios configuration object */
function buildAxiosConfig(context, contentType, accept, headerParams) {
    if (headerParams) {
        return `{
      headers:{
        ...${getConstantName(context, `{
              "Content-Type": "${contentType}",
              Accept: "${accept}",
           }`)},
        ...headerParams,
      },
    }`;
    }
    return getConstantName(context, `{
        headers: {
          "Content-Type": "${contentType}",
          Accept: "${accept}",
        },
     }`);
}
/** Process a single API endpoint method */
function processEndpointMethod(context, endPoint, method, options, pathLevelParams) {
    var _a;
    const { operationId, security } = options;
    // Merge path-level and operation-level parameters
    const allParameters = [
        ...(pathLevelParams || []),
        ...(options.parameters || []),
    ];
    const parameters = resolveParameters(context, allParameters.length > 0 ? allParameters : undefined);
    const serviceName = generateServiceName(endPoint, method, operationId, context.config);
    if (!shouldIncludeMethod(context, serviceName, endPoint, method, operationId)) {
        return;
    }
    context.includedOperations.push({
        parameters,
        requestBody: options.requestBody,
        responses: options.responses,
    });
    // Extract parameters
    const pathParams = getPathParams(parameters);
    const { params: headerParams, isNullable: isHeaderParamsNullable } = getHeaderParams(parameters, context.config);
    const { isNullable: isQueryParamsNullable, params: queryParameters } = getParametersInfo(parameters, "query");
    // Create query params type
    const queryParamsTypeName = createQueryParamsType(context, serviceName, parameters);
    // Extract body and response info
    const requestBody = getBodyContent(options.requestBody);
    const responses = getBodyContent((_a = options.responses) === null || _a === void 0 ? void 0 : _a[200]);
    const contentType = getContentType(context, options.requestBody);
    const accept = getAcceptHeader(options.responses);
    // Build API object
    context.apis.push({
        contentType: contentType,
        summary: options.summary,
        deprecated: options.deprecated,
        serviceName,
        queryParamsTypeName,
        pathParams,
        requestBody,
        headerParams,
        isQueryParamsNullable,
        isHeaderParamsNullable,
        responses,
        pathParamsRefString: buildPathParamsRefString(pathParams),
        endPoint,
        method: method,
        security: security
            ? getConstantName(context, JSON.stringify(security))
            : "undefined",
        additionalAxiosConfig: buildAxiosConfig(context, contentType, accept, headerParams),
        queryParameters,
    });
}
/** Process all API paths */
function processApiPaths(context) {
    Object.entries(context.input.paths).forEach(([endPoint, pathItem]) => {
        const pathLevelParams = pathItem.parameters;
        Object.entries(pathItem).forEach(([method, options]) => {
            if (method === "parameters") {
                return;
            }
            processEndpointMethod(context, endPoint, method, options, pathLevelParams);
        });
    });
}
/** Extract types from OpenAPI components */
function extractComponentTypes(context) {
    if (!context.whitelistFilters.length) {
        extractAllComponentTypes(context);
        return;
    }
    extractReferencedComponentTypes(context);
}
function extractAllComponentTypes(context) {
    const { components } = context.input;
    if (components === null || components === void 0 ? void 0 : components.schemas) {
        Object.entries(components.schemas).forEach(([name, schema]) => {
            context.types.push({ name, schema });
        });
    }
    if (context.input.definitions) {
        Object.entries(context.input.definitions).forEach(([name, schema]) => {
            context.types.push({ name, schema });
        });
    }
    if (components === null || components === void 0 ? void 0 : components.parameters) {
        Object.entries(components.parameters).forEach(([key, value]) => {
            context.types.push(Object.assign(Object.assign({}, value), { name: key }));
        });
    }
    if (components === null || components === void 0 ? void 0 : components.requestBodies) {
        Object.entries(components.requestBodies).forEach(([name, requestBody]) => {
            var _a;
            const schema = (_a = Object.values(requestBody.content || {})[0]) === null || _a === void 0 ? void 0 : _a.schema;
            if (schema) {
                context.types.push({
                    name: `RequestBody${name}`,
                    schema,
                    description: requestBody.description,
                });
            }
        });
    }
}
function extractReferencedComponentTypes(context) {
    const collected = collectReferencedTypes(context);
    const { components } = context.input;
    collected.schemas.forEach((name) => {
        var _a;
        const schema = (_a = components === null || components === void 0 ? void 0 : components.schemas) === null || _a === void 0 ? void 0 : _a[name];
        if (schema) {
            context.types.push({ name, schema });
        }
    });
    collected.definitions.forEach((name) => {
        var _a;
        const schema = (_a = context.input.definitions) === null || _a === void 0 ? void 0 : _a[name];
        if (schema) {
            context.types.push({ name, schema });
        }
    });
    collected.parameters.forEach((name) => {
        var _a;
        const parameter = (_a = components === null || components === void 0 ? void 0 : components.parameters) === null || _a === void 0 ? void 0 : _a[name];
        if (parameter) {
            context.types.push(Object.assign(Object.assign({}, parameter), { name }));
        }
    });
    collected.requestBodies.forEach((name) => {
        var _a, _b;
        const requestBody = (_a = components === null || components === void 0 ? void 0 : components.requestBodies) === null || _a === void 0 ? void 0 : _a[name];
        const schema = requestBody
            ? (_b = Object.values(requestBody.content || {})[0]) === null || _b === void 0 ? void 0 : _b.schema
            : undefined;
        if (schema) {
            context.types.push({
                name: `RequestBody${name}`,
                schema,
                description: requestBody === null || requestBody === void 0 ? void 0 : requestBody.description,
            });
        }
    });
}
function collectReferencedTypes(context) {
    var _a, _b;
    const collected = {
        schemas: new Set(),
        definitions: new Set(),
        parameters: new Set(),
        requestBodies: new Set(),
    };
    const { components } = context.input;
    const collectRef = ($ref) => {
        var _a, _b, _c, _d, _e;
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
                collectSchema((_a = components === null || components === void 0 ? void 0 : components.schemas) === null || _a === void 0 ? void 0 : _a[name]);
                return;
            }
            case "definitions": {
                if (collected.definitions.has(name)) {
                    return;
                }
                collected.definitions.add(name);
                collectSchema((_b = context.input.definitions) === null || _b === void 0 ? void 0 : _b[name]);
                return;
            }
            case "parameters": {
                if (collected.parameters.has(name)) {
                    return;
                }
                collected.parameters.add(name);
                const parameter = (_c = components === null || components === void 0 ? void 0 : components.parameters) === null || _c === void 0 ? void 0 : _c[name];
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
                const requestBody = (_d = components === null || components === void 0 ? void 0 : components.requestBodies) === null || _d === void 0 ? void 0 : _d[name];
                if (requestBody === null || requestBody === void 0 ? void 0 : requestBody.$ref) {
                    collectRef(requestBody.$ref);
                }
                Object.values((requestBody === null || requestBody === void 0 ? void 0 : requestBody.content) || {}).forEach((mediaType) => {
                    collectSchema(mediaType.schema);
                });
                return;
            }
            case "responses": {
                const response = (_e = components === null || components === void 0 ? void 0 : components.responses) === null || _e === void 0 ? void 0 : _e[name];
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
    for (const operation of context.includedOperations) {
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
/** Extract body content from response or request body */
function getBodyContent(responses) {
    if (!responses) {
        return undefined;
    }
    if (responses.content) {
        return Object.values(responses.content)[0].schema;
    }
    if (responses.schema) {
        return responses.schema;
    }
    if (responses.$ref) {
        return { $ref: responses.$ref };
    }
    return undefined;
}
export { generator };
//# sourceMappingURL=generator.mjs.map