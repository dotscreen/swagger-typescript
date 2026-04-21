import {
  getDefineParam,
  getQueryParamString,
  getDefinitionBody,
  getHeaderParamString,
  getKotlinType,
  getSchemaName,
} from "./utils.mjs";
import { ApiAST, Config, Parameter, TypeAST } from "../types.mjs";
import { SERVICE_BEGINNING, DEPRECATED_WARM_MESSAGE } from "./strings.mjs";
import { getJsdoc } from "../utilities/jsdoc.mjs";
import { isAscending } from "../utils.mjs";

function generateApis(
  apis: ApiAST[],
  types: TypeAST[],
  config: Config,
): string {
  let code = SERVICE_BEGINNING;
  try {
    const schemasMap = new Map(
      types
        .filter(({ schema }) => Boolean(schema))
        .map(({ name, schema }) => [getSchemaName(name), schema!] as const),
    );

    const apisCode = apis
      .sort(({ serviceName }, { serviceName: _serviceName }) =>
        isAscending(serviceName, _serviceName),
      )
      .reduce(
        (
          prev,
          {
            contentType,
            summary,
            deprecated,
            serviceName,
            queryParamsTypeName,
            queryParameters,
            pathParams,
            requestBody,
            requestBodyRequired,
            headerParams,
            isQueryParamsNullable,
            isHeaderParamsNullable,
            responses,
            method,
            endPoint,
            pathParamsRefString,
            additionalAxiosConfig,
            security,
          },
        ) => {
          const functionParams = [
            ...pathParams.map(({ name, required, schema, description }) =>
              getDefineParam(
                name,
                required,
                schema,
                config,
                description,
                schemasMap,
              ),
            ),
            ...(requestBody
              ? [
                  getDefinitionBody(
                    "requestBody",
                    requestBodyRequired,
                    requestBody,
                    config,
                    undefined,
                    schemasMap,
                  ),
                ]
              : []),
            ...queryParameters.map(({ name, required, schema, description }) =>
              getQueryParamString(
                name,
                required,
                getKotlinType(schema, config, schemasMap),
                description,
              ),
            ),
            ...((headerParams as Parameter[]) || []).map(
              ({ name, required, description, schema }) =>
                getHeaderParamString(
                  name,
                  required,
                  getKotlinType(schema, config, schemasMap),
                  description,
                ),
            ),
          ];

          return (
            prev +
            `${getJsdoc({
              description: summary,
              deprecated: deprecated ? DEPRECATED_WARM_MESSAGE : undefined,
            })}
  @${method.toUpperCase()}("${endPoint}")
  suspend fun ${serviceName}(
    ${functionParams.join(",\n    ")}
  ): Response<${responses ? getKotlinType(responses, config, schemasMap) : "Any"}>

`
          );
        },
        "",
      );

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
  } catch (error) {
    console.error(error);
    return "";
  }
}

export { generateApis };
