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
  PathItem,
} from "../types.mjs";
import { generateApis } from "./generateApis.mjs";
import { generateTypes } from "./generateTypes.mjs";
import { generateConstants } from "./generateConstants.mjs";
import { generateHook } from "./generateHook.mjs";

type GeneratorContext = {
  apis: ApiAST[];
  types: TypeAST[];
  constants: ConstantsAST[];
  constantsCounter: number;
  input: SwaggerJson;
  config: Config;
  includeFilters: RegExp[];
  excludeFilters: RegExp[];
  whitelistFilters: RegExp[];
  includedOperations: IncludedOperation[];
};

type IncludedOperation = {
  parameters?: Parameter[];
  requestBody?: SwaggerRequest["requestBody"];
  responses?: SwaggerRequest["responses"];
};

function generator(
  input: SwaggerJson,
  config: Config,
): { code: string; hooks: string; type: string } {
  const context: GeneratorContext = {
    apis: [],
    types: [],
    constants: [],
    constantsCounter: 0,
    input,
    config,
    includeFilters: (config.includes || []).map(
      (pattern) => new RegExp(pattern),
    ),
    excludeFilters: (config.excludes || []).map(
      (pattern) => new RegExp(pattern),
    ),
    whitelistFilters: (config.whitelistRegex || []).map(
      (pattern) => new RegExp(pattern),
    ),
    includedOperations: [],
  };

  function hasSwagger2ResponseSchema(): boolean {
    return Object.values(context.input.paths).some((pathItem) =>
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

  try {
    if (context.input.openapi) {
      if (context.input.definitions) {
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
  } catch (error) {
    console.error({ error });
    return { code: "", hooks: "", type: "" };
  }
}

/** Get or create a constant and return its name */
function getConstantName(context: GeneratorContext, value: string): string {
  const existing = context.constants.find((c) => c.value === value);
  if (existing) {
    return existing.name;
  }

  const name = `_CONSTANT${context.constantsCounter++}`;
  context.constants.push({ name, value });
  return name;
}

/** Check if a method should be included based on filters */
function shouldIncludeMethod(
  context: GeneratorContext,
  serviceName: string,
  endPoint: string,
  method: string,
  operationId?: string,
): boolean {
  const whitelistTarget = `${method.toUpperCase()} ${endPoint}`;
  const matchesWhitelist =
    !context.whitelistFilters.length ||
    context.whitelistFilters.some((regex) =>
      [whitelistTarget, endPoint, serviceName, operationId]
        .filter((value): value is string => Boolean(value))
        .some((value) => regex.test(value)),
    );

  const matchesInclude =
    !context.includeFilters.length ||
    context.includeFilters.some((regex) => regex.test(serviceName));

  const matchesExclude = context.excludeFilters.some((regex) =>
    regex.test(serviceName),
  );

  return matchesWhitelist && matchesInclude && !matchesExclude;
}

/** Resolve parameter references */
function resolveParameter(
  context: GeneratorContext,
  parameter: Parameter,
): Parameter {
  const { $ref } = parameter;
  const resolvedParameter = !$ref
    ? parameter
    : {
        ...context.input.components?.parameters?.[
          $ref.replace("#/components/parameters/", "")
        ]!,
        $ref,
        schema: { $ref } as Schema,
      };

  return resolvedParameter.in === "path"
    ? {
        ...resolvedParameter,
        required: true,
      }
    : resolvedParameter;
}

function mergeParameters(
  context: GeneratorContext,
  pathLevelParams?: Parameter[],
  operationLevelParams?: Parameter[],
): Parameter[] | undefined {
  const mergedParameters = new Map<string, Parameter>();

  [...(pathLevelParams || []), ...(operationLevelParams || [])].forEach(
    (parameter) => {
      const resolvedParameter = resolveParameter(context, parameter);
      mergedParameters.set(
        `${resolvedParameter.in}:${resolvedParameter.name}`,
        resolvedParameter,
      );
    },
  );

  return mergedParameters.size > 0
    ? Array.from(mergedParameters.values())
    : undefined;
}

/** Create query params type if needed */
function createQueryParamsType(
  context: GeneratorContext,
  serviceName: string,
  parameters?: Parameter[],
): string | false {
  const {
    exist: isQueryParamsExist,
    isNullable: isQueryParamsNullable,
    params: queryParameters,
  } = getParametersInfo(parameters, "query");

  if (!isQueryParamsExist) {
    return false;
  }

  const typeName = `${toPascalCase(serviceName)}QueryParams`;
  const properties = queryParameters?.reduce(
    (prev, { name, schema, $ref, required: _required, description }) => ({
      ...prev,
      [name]: {
        ...($ref ? { $ref } : schema),
        description,
      } as Schema,
    }),
    {},
  );
  const required = queryParameters
    ?.filter(({ required: isRequired }) => isRequired)
    .map(({ name }) => name);

  context.types.push({
    name: typeName,
    schema: {
      type: "object",
      nullable: isQueryParamsNullable,
      properties,
      required,
    },
  });

  return typeName;
}

/** Get content type from request body */
function getContentType(
  context: GeneratorContext,
  requestBody?: SwaggerRequest["requestBody"],
): string {
  const content = requestBody?.content ||
    (requestBody?.$ref &&
      context.input.components?.requestBodies?.[
        getRefName(requestBody.$ref as string)
      ]?.content) || { "application/json": null };

  return Object.keys(content)[0];
}

/** Get accept header from responses */
function getAcceptHeader(responses?: SwaggerRequest["responses"]): string {
  const content = responses?.[200]?.content || { "application/json": null };
  return Object.keys(content)[0];
}

function isRequestBodyRequired(
  context: GeneratorContext,
  requestBody?: SwaggerRequest["requestBody"],
): boolean {
  if (!requestBody) {
    return false;
  }

  if (requestBody.required === true) {
    return true;
  }

  if (!requestBody.$ref) {
    return false;
  }

  return (
    context.input.components?.requestBodies?.[
      getRefName(requestBody.$ref as string)
    ]?.required === true
  );
}

/** Build path params reference string */
function buildPathParamsRefString(pathParams: Parameter[]): string | undefined {
  if (pathParams.length === 0) {
    return undefined;
  }

  const paramNames = pathParams.map(({ name }) => name).join(",");
  return `{${paramNames}}`;
}

/** Build Axios configuration object */
function buildAxiosConfig(
  context: GeneratorContext,
  contentType: string,
  accept: string,
  headerParams?: string,
): string {
  if (headerParams) {
    return `{
      headers:{
        ...${getConstantName(
          context,
          `{
              "Content-Type": "${contentType}",
              Accept: "${accept}",
           }`,
        )},
        ...headerParams,
      },
    }`;
  }

  return getConstantName(
    context,
    `{
        headers: {
          "Content-Type": "${contentType}",
          Accept: "${accept}",
        },
     }`,
  );
}

/** Process a single API endpoint method */
function processEndpointMethod(
  context: GeneratorContext,
  endPoint: string,
  method: string,
  options: SwaggerRequest,
  pathLevelParams?: Parameter[],
): void {
  const { operationId, security } = options;

  // Merge path-level and operation-level parameters
  const parameters = mergeParameters(
    context,
    pathLevelParams,
    options.parameters,
  );

  const serviceName = generateServiceName(
    endPoint,
    method,
    operationId,
    context.config,
  );

  if (
    !shouldIncludeMethod(context, serviceName, endPoint, method, operationId)
  ) {
    return;
  }

  context.includedOperations.push({
    parameters,
    requestBody: options.requestBody,
    responses: options.responses,
  });

  // Extract parameters
  const pathParams = getPathParams(parameters);
  const { params: headerParams, isNullable: isHeaderParamsNullable } =
    getHeaderParams(parameters, context.config);
  const { isNullable: isQueryParamsNullable, params: queryParameters } =
    getParametersInfo(parameters, "query");

  // Create query params type
  const queryParamsTypeName = createQueryParamsType(
    context,
    serviceName,
    parameters,
  );

  // Extract body and response info
  const requestBody = getBodyContent(options.requestBody);
  const requestBodyRequired = isRequestBodyRequired(
    context,
    options.requestBody,
  );
  const responses = getBodyContent(options.responses?.[200]);
  const contentType = getContentType(context, options.requestBody);
  const accept = getAcceptHeader(options.responses);

  // Build API object
  context.apis.push({
    contentType: contentType as ApiAST["contentType"],
    summary: options.summary,
    deprecated: options.deprecated,
    serviceName,
    queryParamsTypeName,
    pathParams,
    requestBody,
    requestBodyRequired,
    headerParams,
    isQueryParamsNullable,
    isHeaderParamsNullable,
    responses,
    pathParamsRefString: buildPathParamsRefString(pathParams),
    endPoint,
    method: method as Method,
    security: security
      ? getConstantName(context, JSON.stringify(security))
      : "undefined",
    additionalAxiosConfig: buildAxiosConfig(
      context,
      contentType,
      accept,
      headerParams,
    ),
    queryParameters,
  });
}

/** Process all API paths */
function processApiPaths(context: GeneratorContext): void {
  Object.entries(context.input.paths).forEach(([endPoint, pathItem]) => {
    const pathLevelParams = pathItem.parameters as Parameter[] | undefined;

    Object.entries(pathItem).forEach(([method, options]) => {
      if (method === "parameters") {
        return;
      }

      processEndpointMethod(
        context,
        endPoint,
        method,
        options as SwaggerRequest,
        pathLevelParams,
      );
    });
  });
}

/** Extract types from OpenAPI components */
function extractComponentTypes(context: GeneratorContext): void {
  if (!context.whitelistFilters.length) {
    extractAllComponentTypes(context);
    return;
  }

  extractReferencedComponentTypes(context);
}

function extractAllComponentTypes(context: GeneratorContext): void {
  const { components } = context.input;

  if (components?.schemas) {
    Object.entries(components.schemas).forEach(([name, schema]) => {
      context.types.push({ name, schema });
    });
  }

  if (context.input.definitions) {
    Object.entries(context.input.definitions).forEach(([name, schema]) => {
      context.types.push({ name, schema });
    });
  }

  if (components?.parameters) {
    Object.entries(components.parameters).forEach(([key, value]) => {
      context.types.push({ ...value, name: key });
    });
  }

  if (components?.requestBodies) {
    Object.entries(components.requestBodies).forEach(([name, requestBody]) => {
      const schema = Object.values(requestBody.content || {})[0]?.schema;
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

function extractReferencedComponentTypes(context: GeneratorContext): void {
  const collected = collectReferencedTypes(context);
  const { components } = context.input;

  collected.schemas.forEach((name) => {
    const schema = components?.schemas?.[name];
    if (schema) {
      context.types.push({ name, schema });
    }
  });

  collected.definitions.forEach((name) => {
    const schema = context.input.definitions?.[name];
    if (schema) {
      context.types.push({ name, schema });
    }
  });

  collected.parameters.forEach((name) => {
    const parameter = components?.parameters?.[name];
    if (parameter) {
      context.types.push({ ...parameter, name });
    }
  });

  collected.requestBodies.forEach((name) => {
    const requestBody = components?.requestBodies?.[name];
    const schema = requestBody
      ? Object.values(requestBody.content || {})[0]?.schema
      : undefined;

    if (schema) {
      context.types.push({
        name: `RequestBody${name}`,
        schema,
        description: requestBody?.description,
      });
    }
  });
}

function collectReferencedTypes(context: GeneratorContext): {
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

  const { components } = context.input;

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
        collectSchema(components?.schemas?.[name]);
        return;
      }
      case "definitions": {
        if (collected.definitions.has(name)) {
          return;
        }

        collected.definitions.add(name);
        collectSchema(context.input.definitions?.[name]);
        return;
      }
      case "parameters": {
        if (collected.parameters.has(name)) {
          return;
        }

        collected.parameters.add(name);
        const parameter = components?.parameters?.[name];
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
        const requestBody = components?.requestBodies?.[name];
        if (requestBody?.$ref) {
          collectRef(requestBody.$ref);
        }
        Object.values(requestBody?.content || {}).forEach((mediaType) => {
          collectSchema(mediaType.schema);
        });
        return;
      }
      case "responses": {
        const response = components?.responses?.[name];
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

  for (const operation of context.includedOperations) {
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

/** Extract body content from response or request body */
function getBodyContent(responses?: SwaggerResponse): Schema | undefined {
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
    return { $ref: responses.$ref } as Schema;
  }

  return undefined;
}

export { generator };
