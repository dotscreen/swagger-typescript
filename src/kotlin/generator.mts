import {
  getPathParams,
  generateServiceName,
  getHeaderParams,
  getParametersInfo,
  getRefName,
  toPascalCase,
} from "./utils.mjs";
import type {
  SwaggerRequest,
  SwaggerJson,
  SwaggerResponse,
  Config,
  ApiAST,
  TypeAST,
  Schema,
  Parameter,
  ConstantsAST,
  Method,
} from "../types.mjs";
import { generateApis } from "./generateApis.mjs";
import { generateTypes } from "./generateTypes.mjs";

function generator(
  input: SwaggerJson,
  config: Config,
): { code: string; type: string } {
  const apis: ApiAST[] = [];
  const types: TypeAST[] = [];
  let constantsCounter = 0;
  const constants: ConstantsAST[] = [];
  const whitelistFilters = (config.whitelistRegex || []).map(
    (pattern) => new RegExp(pattern),
  );
  const includedOperations: {
    parameters?: Parameter[];
    requestBody?: SwaggerRequest["requestBody"];
    responses?: SwaggerRequest["responses"];
  }[] = [];

  function hasSwagger2ResponseSchema(): boolean {
    return Object.values(input.paths).some((pathItem) =>
      Object.values(pathItem).some((value) => {
        if (!value || typeof value !== "object") {
          return false;
        }
        if ((value as SwaggerRequest).responses) {
          return Object.values((value as SwaggerRequest).responses).some(
            (response) => response?.schema,
          );
        }
        return false;
      }),
    );
  }

  function getConstantName(value: string) {
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
        console.warn(
          "OpenAPI 3 input contains Swagger 2 'definitions'. Fallbacks will be used.",
        );
      }

      if (hasSwagger2ResponseSchema()) {
        console.warn(
          "OpenAPI 3 input contains Swagger 2 'responses.schema'. Fallbacks will be used.",
        );
      }
    }

    Object.entries(input.paths).forEach(([endPoint, value]) => {
      const parametersExtended = value.parameters as Parameter[] | undefined;
      Object.entries(value).forEach(
        ([method, options]: [string, SwaggerRequest]) => {
          if (method === "parameters") {
            return;
          }

          const { operationId, security } = options;

          const allParameters =
            parametersExtended || options.parameters
              ? [...(parametersExtended || []), ...(options.parameters || [])]
              : undefined;

          const parameters = allParameters?.map<Parameter>((parameter) => {
            const { $ref } = parameter;
            if ($ref) {
              const name = $ref.replace("#/components/parameters/", "");
              return {
                ...input.components?.parameters?.[name]!,
                $ref,
                schema: { $ref } as Schema,
              };
            }
            return parameter;
          });

          const serviceName = generateServiceName(
            endPoint,
            method,
            operationId,
            config,
          );

          const whitelistTarget = `${method.toUpperCase()} ${endPoint}`;
          const matchesWhitelist =
            !whitelistFilters.length ||
            whitelistFilters.some((regex) =>
              [whitelistTarget, endPoint, serviceName, operationId]
                .filter((value): value is string => Boolean(value))
                .some((value) => regex.test(value)),
            );

          if (!matchesWhitelist) {
            return;
          }

          includedOperations.push({
            parameters,
            requestBody: options.requestBody,
            responses: options.responses,
          });

          const pathParams = getPathParams(parameters);

          const {
            exist: isQueryParamsExist,
            isNullable: isQueryParamsNullable,
            params: queryParameters,
          } = getParametersInfo(parameters, "query");
          const queryParamsTypeName: string | false = isQueryParamsExist
            ? `${toPascalCase(serviceName)}QueryParams`
            : false;

          if (queryParamsTypeName) {
            types.push({
              name: queryParamsTypeName,
              schema: {
                type: "object",
                nullable: isQueryParamsNullable,
                properties: queryParameters?.reduce(
                  (
                    prev,
                    { name, schema, $ref, required: _required, description },
                  ) => {
                    return {
                      ...prev,
                      [name]: {
                        ...($ref ? { $ref } : schema),
                        nullable: !_required,
                        description,
                      } as Schema,
                    };
                  },
                  {},
                ),
              },
            });
          }

          const { params: headerParams, isNullable: hasNullableHeaderParams } =
            getHeaderParams(parameters, config);

          const requestBody = getBodyContent(options.requestBody);

          const contentType = Object.keys(
            options.requestBody?.content ||
              (options.requestBody?.$ref &&
                input.components?.requestBodies?.[
                  getRefName(options.requestBody.$ref as string)
                ]?.content) || {
                "application/json": null,
              },
          )[0] as ApiAST["contentType"];

          const accept = Object.keys(
            options.responses?.[200]?.content || {
              "application/json": null,
            },
          )[0];

          const responses = getBodyContent(options.responses?.[200]);

          let pathParamsRefString: string | undefined = pathParams.reduce(
            (prev, { name }) => `${prev}${name},`,
            "",
          );
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
            method: method as Method,
            security: security
              ? getConstantName(JSON.stringify(security))
              : "undefined",
            additionalAxiosConfig,
            queryParameters,
          });
        },
      );
    });

    if (!whitelistFilters.length) {
      if (input?.components?.schemas) {
        types.push(
          ...Object.entries(input.components.schemas).map(([name, schema]) => {
            return {
              name,
              schema,
            };
          }),
        );
      }

      if (input?.definitions) {
        types.push(
          ...Object.entries(input.definitions).map(([name, schema]) => {
            return {
              name,
              schema,
            };
          }),
        );
      }

      if (input?.components?.parameters) {
        types.push(
          ...Object.entries(input.components.parameters).map(
            ([key, value]) => ({
              ...value,
              name: key,
            }),
          ),
        );
      }

      if (input?.components?.requestBodies) {
        types.push(
          ...(Object.entries(input.components.requestBodies)
            .map(([name, _requestBody]) => {
              return {
                name: `RequestBody${name}`,
                schema: Object.values(_requestBody.content || {})[0]?.schema,
                description: _requestBody.description,
              };
            })
            .filter((v) => v.schema) as any),
        );
      }
    } else {
      const collected = collectReferencedTypes(input, includedOperations);

      collected.schemas.forEach((name) => {
        const schema = input.components?.schemas?.[name];
        if (schema) {
          types.push({ name, schema });
        }
      });

      collected.definitions.forEach((name) => {
        const schema = input.definitions?.[name];
        if (schema) {
          types.push({ name, schema });
        }
      });

      collected.parameters.forEach((name) => {
        const parameter = input.components?.parameters?.[name];
        if (parameter) {
          types.push({ ...parameter, name });
        }
      });

      collected.requestBodies.forEach((name) => {
        const requestBody = input.components?.requestBodies?.[name];
        const schema = requestBody
          ? Object.values(requestBody.content || {})[0]?.schema
          : undefined;

        if (schema) {
          types.push({
            name: `RequestBody${name}`,
            schema,
            description: requestBody?.description,
          });
        }
      });
    }

    const code = generateApis(apis, types, config);
    const type = generateTypes(types, config);

    return { code, type };
  } catch (error) {
    console.error({ error });
    return { code: "", type: "" };
  }
}

function collectReferencedTypes(
  input: SwaggerJson,
  includedOperations: {
    parameters?: Parameter[];
    requestBody?: SwaggerRequest["requestBody"];
    responses?: SwaggerRequest["responses"];
  }[],
): {
  schemas: Set<string>;
  definitions: Set<string>;
  parameters: Set<string>;
  requestBodies: Set<string>;
} {
  const collected = {
    schemas: new Set<string>(),
    definitions: new Set<string>(),
    parameters: new Set<string>(),
    requestBodies: new Set<string>(),
  };

  const collectRef = ($ref: string): void => {
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
        collectSchema(input.components?.schemas?.[name]);
        return;
      }
      case "definitions": {
        if (collected.definitions.has(name)) {
          return;
        }

        collected.definitions.add(name);
        collectSchema(input.definitions?.[name]);
        return;
      }
      case "parameters": {
        if (collected.parameters.has(name)) {
          return;
        }

        collected.parameters.add(name);
        const parameter = input.components?.parameters?.[name];
        if (parameter?.$ref) {
          collectRef(parameter.$ref);
        }
        collectSchema(parameter?.schema);
        return;
      }
      case "requestBodies": {
        if (collected.requestBodies.has(name)) {
          return;
        }

        collected.requestBodies.add(name);
        const requestBody = input.components?.requestBodies?.[name];
        if (requestBody?.$ref) {
          collectRef(requestBody.$ref);
        }
        Object.values(requestBody?.content || {}).forEach((mediaType) => {
          collectSchema(mediaType.schema);
        });
        return;
      }
      case "responses": {
        const response = input.components?.responses?.[name];
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

  const collectSchema = (schema?: Schema | {} | true): void => {
    if (!schema || schema === true || typeof schema !== "object") {
      return;
    }

    const typedSchema = schema as Schema;

    if (typedSchema.$ref) {
      collectRef(typedSchema.$ref);
    }

    collectSchema(typedSchema.items as Schema | {} | true);
    collectSchema(typedSchema.additionalProperties as Schema | {} | true);
    collectSchema(typedSchema.not);
    typedSchema.allOf?.forEach((value) => collectSchema(value));
    typedSchema.oneOf?.forEach((value) => collectSchema(value));
    typedSchema.anyOf?.forEach((value) => collectSchema(value));
    Object.values(typedSchema.properties || {}).forEach((value) =>
      collectSchema(value),
    );
    Object.values(typedSchema.discriminator?.mapping || {}).forEach((value) =>
      collectRef(value),
    );
  };

  for (const operation of includedOperations) {
    operation.parameters?.forEach((parameter) => {
      if (parameter.$ref) {
        collectRef(parameter.$ref);
      }
      collectSchema(parameter.schema);
    });

    if (operation.requestBody?.$ref) {
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

function getBodyContent(responses?: SwaggerResponse): Schema | undefined {
  if (!responses) {
    return responses;
  }

  return responses.content
    ? Object.values(responses.content)[0].schema
    : responses.schema
    ? responses.schema
    : responses.$ref
    ? ({
        $ref: responses.$ref,
      } as Schema)
    : undefined;
}

export { generator };
