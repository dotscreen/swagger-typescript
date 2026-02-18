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
function shouldIncludeMethod(context, serviceName) {
    const matchesInclude = !context.includeFilters.length ||
        context.includeFilters.some((regex) => regex.test(serviceName));
    const matchesExclude = context.excludeFilters.some((regex) => regex.test(serviceName));
    return matchesInclude && !matchesExclude;
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
    if (!shouldIncludeMethod(context, serviceName)) {
        return;
    }
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
    const { components } = context.input;
    // Extract schemas
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
    // Extract parameters
    if (components === null || components === void 0 ? void 0 : components.parameters) {
        Object.entries(components.parameters).forEach(([key, value]) => {
            context.types.push(Object.assign(Object.assign({}, value), { name: key }));
        });
    }
    // Extract request bodies
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