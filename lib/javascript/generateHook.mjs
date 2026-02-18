import { getTsType, getDefineParam, getParamString, toPascalCase, getSchemaName, } from "./utils.mjs";
import { DEPRECATED_WARM_MESSAGE, getHooksFunctions, getHooksImports, } from "./strings.mjs";
import { getJsdoc } from "../utilities/jsdoc.mjs";
import { isAscending, isMatchWholeWord } from "../utils.mjs";
const ALLOWED_PAGE_PARAM_NAMES = ["page", "pageno", "pagenumber", "offset"];
function generateHook(apis, types, config) {
    var _a;
    try {
        const context = {
            config,
            hasInfiniteQuery: !!((_a = config.useInfiniteQuery) === null || _a === void 0 ? void 0 : _a.length),
            hasMutationWithoutVariables: false,
        };
        const sortedApis = apis.sort(({ serviceName }, { serviceName: other }) => isAscending(serviceName, other));
        const apisCode = sortedApis
            .map((api) => generateSingleHook(api, context))
            .join("\n");
        return buildFinalCode(apisCode, types, sortedApis, context);
    }
    catch (error) {
        console.error(error);
        return "";
    }
}
/** Generate code for a single hook */
function generateSingleHook(api, context) {
    const hookName = `use${toPascalCase(api.serviceName)}`;
    const isInfiniteQuery = shouldUseInfiniteQuery(api, hookName, context);
    const isQuery = isInfiniteQuery || shouldUseQuery(api, hookName, context);
    const hookConfig = buildHookConfig(api, isQuery, isInfiniteQuery, context);
    let code = generateHookJsDoc(api);
    code += generateHookSignature(hookName, isQuery, hookConfig);
    code += generateHookBody(api, hookName, isQuery, isInfiniteQuery, hookConfig);
    if (isQuery) {
        code += generateInfoMethod(api, hookName, isInfiniteQuery, hookConfig);
        code += generatePrefetchMethod(api, hookName, hookConfig);
    }
    return code;
}
/** Build configuration object for hook generation */
function buildHookConfig(api, isQuery, isInfiniteQuery, context) {
    const TData = api.responses
        ? getTsType(api.responses, context.config)
        : "any";
    const TQueryFnData = `SwaggerResponse<${TData}>`;
    const TError = "RequestError | Error";
    return {
        api,
        isQuery,
        isInfiniteQuery,
        TData,
        TQueryFnData,
        TError,
        paramsString: buildParamsString(api, false),
        paramsStringOverride: buildParamsString(api, isInfiniteQuery),
        queryKey: buildQueryKey(api),
        variables: buildVariables(api, context),
        params: buildHookParams(api, isQuery, isInfiniteQuery, TData, TQueryFnData, TError, context),
    };
}
/** Check if hook should use infinite query */
function shouldUseInfiniteQuery(api, hookName, context) {
    var _a;
    return !!((_a = context.config.useInfiniteQuery) === null || _a === void 0 ? void 0 : _a.find((name) => name.toLowerCase() === api.serviceName.toLowerCase() ||
        name.toLowerCase() === hookName.toLowerCase()));
}
/** Check if hook should use query (not mutation) */
function shouldUseQuery(api, hookName, context) {
    var _a;
    if (api.method === "get") {
        return true;
    }
    return !!((_a = context.config.useQuery) === null || _a === void 0 ? void 0 : _a.find((name) => name.toLowerCase() === api.serviceName.toLowerCase() ||
        name.toLowerCase() === hookName.toLowerCase()));
}
/** Build params string for function calls */
function buildParamsString(api, usePageParam) {
    const parts = [];
    if (api.pathParams.length) {
        parts.push(api.pathParams.map(({ name }) => name).join(","));
    }
    if (api.requestBody) {
        parts.push("requestBody");
    }
    if (api.queryParamsTypeName) {
        if (usePageParam) {
            parts.push("{ ..._param, ...queryParams }");
        }
        else {
            parts.push("queryParams");
        }
    }
    if (api.headerParams) {
        parts.push("headerParams");
    }
    return parts.join(", ");
}
/** Build query key array */
function buildQueryKey(api) {
    const parts = [`${api.serviceName}.key`];
    if (api.pathParams.length) {
        parts.push(...api.pathParams.map(({ name }) => name));
    }
    if (api.requestBody) {
        parts.push("requestBody");
    }
    if (api.queryParamsTypeName) {
        parts.push("queryParams");
    }
    if (api.headerParams) {
        parts.push("headerParams");
    }
    return `[${parts.join(", ")}]`;
}
/** Build TypeScript variables type string */
function buildVariables(api, context) {
    const parts = [];
    // Path parameters
    api.pathParams.forEach(({ name, required, schema, description }) => {
        parts.push(getDefineParam(name, required, schema, context.config, description));
    });
    // Request body
    if (api.requestBody) {
        parts.push(getDefineParam("requestBody", true, api.requestBody, context.config));
    }
    // Query parameters
    if (api.queryParamsTypeName) {
        parts.push(getParamString("queryParams", !api.isQueryParamsNullable, api.queryParamsTypeName));
    }
    // Header parameters
    if (api.headerParams) {
        parts.push(getParamString("headerParams", !api.isHeaderParamsNullable, api.headerParams));
    }
    return parts.join(", ");
}
/** Build hook parameters for function signature */
function buildHookParams(api, isQuery, isInfiniteQuery, TData, TQueryFnData, TError, context) {
    const params = [];
    if (isQuery) {
        const variables = buildVariables(api, {
            config: {},
            hasInfiniteQuery: false,
            hasMutationWithoutVariables: false,
        });
        if (variables.length > 0) {
            params.push(variables);
        }
    }
    // Options parameter
    let optionsType;
    if (isInfiniteQuery) {
        optionsType = `UseInfiniteQueryOptions<${TQueryFnData}, ${TError}>`;
    }
    else if (isQuery) {
        optionsType = `SwaggerTypescriptUseQueryOptions<${TData}>`;
    }
    else {
        const variables = buildVariables(api, {
            config: {},
            hasInfiniteQuery: false,
            hasMutationWithoutVariables: false,
        });
        if ((variables === null || variables === void 0 ? void 0 : variables.length) > 0) {
            optionsType = `SwaggerTypescriptUseMutationOptions<${TData}, {${variables}}, TExtra>`;
        }
        else {
            // Mark that we need the void mutation type
            context.hasMutationWithoutVariables = true;
            optionsType = `SwaggerTypescriptUseMutationOptionsVoid<${TData}, TExtra>`;
        }
    }
    params.push(`options?: ${optionsType}`);
    if (isQuery) {
        params.push("configOverride?: AxiosRequestConfig");
    }
    return params;
}
/** Generate JSDoc for hook */
function generateHookJsDoc(api) {
    return getJsdoc({
        description: api.summary,
        deprecated: api.deprecated ? DEPRECATED_WARM_MESSAGE : undefined,
    });
}
/** Generate hook function signature */
function generateHookSignature(hookName, isQuery, config) {
    const generic = isQuery ? "" : "<TExtra>";
    const params = config.params.join(", ");
    return `export const ${hookName} =${generic} (${params}) => {`;
}
/** Generate hook body */
function generateHookBody(api, hookName, isQuery, isInfiniteQuery, config) {
    if (isQuery) {
        return generateQueryHookBody(api, hookName, isInfiniteQuery, config);
    }
    return generateMutationHookBody(api, config);
}
/** Generate query hook body */
function generateQueryHookBody(api, hookName, isInfiniteQuery, config) {
    let code = `
    const { key, fun } = ${hookName}.info(${config.paramsString ? `${config.paramsString}, ` : ""}configOverride);
  `;
    if (isInfiniteQuery) {
        const pageParam = findPageParameter(api);
        code += `
      const {
        data: { pages } = {},
        data,
        ...rest
      } = useInfiniteQuery({
        queryKey: key,
        queryFn: ({ pageParam }) => fun({ ${pageParam}: pageParam }),
        initialPageParam: 1,
        getNextPageParam: (_lastPage, allPages) => allPages.length + 1,
        ...(options as any),
      });

      const list = useMemo(() => paginationFlattenData(pages), [pages]);
      const total = getTotal(pages);
      const hasMore = useHasMore(pages, list, queryParams);
      
      return { ...rest, data, list, hasMore, total };
    `;
    }
    else {
        code += `
      return useQuery({
        queryKey: key,
        queryFn: fun,
        ...options
      });
    `;
    }
    code += "};";
    return code;
}
/** Generate mutation hook body */
function generateMutationHookBody(api, config) {
    return `
    return useMutation({
      mutationFn: (_o) => {
        const { ${config.paramsString ? `${config.paramsString},` : ""}configOverride } = _o || {};
        return ${api.serviceName}(${config.paramsString ? `${config.paramsString},` : ""}configOverride);
      },
      ...options
    });
  };`;
}
/** Find page parameter name from query parameters */
function findPageParameter(api) {
    var _a;
    const param = (_a = api.queryParameters) === null || _a === void 0 ? void 0 : _a.find(({ name }) => ALLOWED_PAGE_PARAM_NAMES.includes(name.toLowerCase()));
    return (param === null || param === void 0 ? void 0 : param.name) || "page";
}
/** Generate info method for query hooks */
function generateInfoMethod(api, hookName, isInfiniteQuery, config) {
    const infoParams = config.params
        .filter((p) => !p.startsWith("options?:"))
        .join(", ");
    const queryParamForPaging = isInfiniteQuery
        ? api.queryParamsTypeName
            ? getParamString("_param", true, api.queryParamsTypeName, undefined, true)
            : ""
        : "";
    return `
    ${hookName}.info = (${infoParams}) => {
      return {
        key: ${config.queryKey} as QueryKey,
        fun: (${queryParamForPaging}) => ${api.serviceName}(
          ${config.paramsStringOverride
        ? `${config.paramsStringOverride},
            `
        : ""}configOverride
        ),
      };
    };`;
}
/** Generate prefetch method for query hooks */
function generatePrefetchMethod(api, hookName, config) {
    return `
    ${hookName}.prefetch = (
      client: QueryClient,
      ${config.params.join(", ")}
    ) => {
      const { key, fun } = ${hookName}.info(${config.paramsString ? `${config.paramsString},` : ""}configOverride);

      return client.getQueryData(key)
        ? Promise.resolve()
        : client.prefetchQuery({
            queryKey: key,
            queryFn: () => fun(),
            ...options
          });
    };`;
}
/** Build final code with imports and exports */
function buildFinalCode(apisCode, types, apis, context) {
    let code = getHooksImports({ hasInfinity: context.hasInfiniteQuery });
    // Add type imports
    code += buildTypeImports(types, apisCode);
    // Add service imports
    code += buildServiceImports(apis);
    // Add helper functions
    code += getHooksFunctions({ hasInfinity: context.hasInfiniteQuery });
    // Add type definitions
    code += `
    export type SwaggerTypescriptMutationDefaultParams<TExtra> = {_extraVariables?: TExtra, configOverride?: AxiosRequestConfig}
    type SwaggerTypescriptUseQueryOptions<TData> = Omit<UseQueryOptions<SwaggerResponse<TData>, RequestError | Error>, "queryKey">;

    type SwaggerTypescriptUseMutationOptions<TData, TRequest, TExtra> = UseMutationOptions<
      SwaggerResponse<TData>,
      RequestError | Error,
      TRequest & SwaggerTypescriptMutationDefaultParams<TExtra>
    >;
  `;
    // Add SwaggerTypescriptUseMutationOptionsVoid only if needed
    if (context.hasMutationWithoutVariables) {
        code += `
    type SwaggerTypescriptUseMutationOptionsVoid<TData, TExtra> = UseMutationOptions<
      SwaggerResponse<TData>,
      RequestError | Error,
      SwaggerTypescriptMutationDefaultParams<TExtra> | void
    >;
  `;
    }
    // Add generated hooks
    code += apisCode;
    return code;
}
/** Build type imports from types used in APIs */
function buildTypeImports(types, apisCode) {
    const usedTypes = types
        .sort(({ name }, { name: other }) => isAscending(name, other))
        .filter(({ name }) => isMatchWholeWord(apisCode, getSchemaName(name)))
        .map(({ name }) => getSchemaName(name));
    if (usedTypes.length === 0) {
        return 'import type {} from "./types"\n';
    }
    return `import type { ${usedTypes.join(", ")} } from "./types"\n`;
}
/** Build service imports */
function buildServiceImports(apis) {
    const services = apis.map(({ serviceName }) => serviceName);
    return `import { ${services.join(", ")} } from "./services"\n`;
}
export { generateHook };
//# sourceMappingURL=generateHook.mjs.map