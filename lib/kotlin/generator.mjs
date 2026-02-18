import { getPathParams, generateServiceName, getHeaderParams, getParametersInfo, getRefName, toPascalCase, } from "./utils.mjs";
import { generateApis } from "./generateApis.mjs";
import { generateTypes } from "./generateTypes.mjs";
function generator(input, config) {
    var _a, _b, _c;
    const apis = [];
    const types = [];
    let constantsCounter = 0;
    const constants = [];
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
                const allParameters = parametersExtended || options.parameters
                    ? [...(parametersExtended || []), ...(options.parameters || [])]
                    : undefined;
                const parameters = allParameters === null || allParameters === void 0 ? void 0 : allParameters.map((parameter) => {
                    var _a, _b;
                    const { $ref } = parameter;
                    if ($ref) {
                        const name = $ref.replace("#/components/parameters/", "");
                        return Object.assign(Object.assign({}, (_b = (_a = input.components) === null || _a === void 0 ? void 0 : _a.parameters) === null || _b === void 0 ? void 0 : _b[name]), { $ref, schema: { $ref } });
                    }
                    return parameter;
                });
                const serviceName = generateServiceName(endPoint, method, operationId, config);
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
        const code = generateApis(apis, types, config);
        const type = generateTypes(types, config);
        return { code, type };
    }
    catch (error) {
        console.error({ error });
        return { code: "", type: "" };
    }
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