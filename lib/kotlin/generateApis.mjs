import { getDefineParam, getQueryParamString, getDefinitionBody, getHeaderParamString, getKotlinType, } from "./utils.mjs";
import { SERVICE_BEGINNING, DEPRECATED_WARM_MESSAGE } from "./strings.mjs";
import { getJsdoc } from "../utilities/jsdoc.mjs";
import { isAscending } from "../utils.mjs";
function generateApis(apis, types, config) {
    let code = SERVICE_BEGINNING;
    try {
        const apisCode = apis
            .sort(({ serviceName }, { serviceName: _serviceName }) => isAscending(serviceName, _serviceName))
            .reduce((prev, { contentType, summary, deprecated, serviceName, queryParamsTypeName, queryParameters, pathParams, requestBody, requestBodyRequired, headerParams, isQueryParamsNullable, isHeaderParamsNullable, responses, method, endPoint, pathParamsRefString, additionalAxiosConfig, security, }) => {
            const functionParams = [
                ...pathParams.map(({ name, required, schema, description }) => getDefineParam(name, required, schema, config, description)),
                ...(requestBody
                    ? [
                        getDefinitionBody("requestBody", requestBodyRequired, requestBody, config),
                    ]
                    : []),
                ...queryParameters.map(({ name, required, schema, description }) => getQueryParamString(name, required, getKotlinType(schema, config), description)),
                ...(headerParams || []).map(({ name, required, description, schema }) => getHeaderParamString(name, required, getKotlinType(schema, config), description)),
            ];
            return (prev +
                `${getJsdoc({
                    description: summary,
                    deprecated: deprecated ? DEPRECATED_WARM_MESSAGE : undefined,
                })}
  @${method.toUpperCase()}("${endPoint}")
  suspend fun ${serviceName}(
    ${functionParams.join(",\n    ")}
  ): Response<${responses ? getKotlinType(responses, config) : "Any"}>

`);
        }, "");
        code += `
package ${config.kotlinPackage}

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.http.Query

interface IApis {
    ${apisCode}
}`;
        return code;
    }
    catch (error) {
        console.error(error);
        return "";
    }
}
export { generateApis };
//# sourceMappingURL=generateApis.mjs.map