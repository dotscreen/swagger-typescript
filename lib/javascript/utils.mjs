import { getJsdoc } from "../utilities/jsdoc.mjs";
import { isAscending } from "../utils.mjs";
function getPathParams(parameters) {
    return ((parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: location }) => {
        return location === "path";
    })) || []);
}
function isParameterRequired(parameter) {
    return parameter.required === true;
}
function getHeaderParams(parameters, config) {
    const headerParamsArray = (parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: location, name }) => {
        var _a, _b;
        return (location === "header" && !((_b = (_a = config.ignore) === null || _a === void 0 ? void 0 : _a.headerParams) === null || _b === void 0 ? void 0 : _b.includes(name)));
    })) || [];
    const params = getObjectType(headerParamsArray.map((parameter) => (Object.assign(Object.assign({}, parameter), { schema: Object.assign(Object.assign({}, parameter.schema), { optional: !isParameterRequired(parameter) }) }))), config, undefined);
    return {
        params,
        isNullable: headerParamsArray.every((parameter) => !isParameterRequired(parameter)),
    };
}
/**
 * Converts a string to PascalCase (first letter uppercase)
 *
 * @param str - String to convert
 * @returns PascalCase version of the string
 */
function toPascalCase(str) {
    return `${str.substring(0, 1).toUpperCase()}${str.substring(1)}`;
}
/**
 * Replaces delimiter characters with uppercase following characters
 *
 * @param str - String to process
 * @param delimiter - Delimiter character to split on
 * @returns Processed string with delimiters removed and following chars
 *   uppercased
 */
function replaceWithUpper(str, delimiter) {
    let parts = str.split(delimiter);
    parts = parts.map((part) => toPascalCase(part));
    return parts.join("");
}
/**
 * Generates a service method name based on endpoint, method, and configuration
 *
 * @param endPoint - API endpoint path
 * @param method - HTTP method (GET, POST, etc.)
 * @param operationId - Optional operation ID from OpenAPI spec
 * @param config - Configuration object containing naming rules
 * @returns Generated service method name
 */
function generateServiceName(endPoint, method, operationId, config) {
    const { methodName, prefix = "" } = config;
    const cleanedEndPoint = endPoint.replace(new RegExp(`^${prefix}`, "i"), "");
    const path = getSchemaName(cleanedEndPoint);
    const methodNameTemplate = getTemplate(methodName, operationId);
    const serviceName = template(methodNameTemplate, Object.assign({ path,
        method }, (operationId ? { operationId } : {})));
    return serviceName;
}
function getTemplate(methodName, operationId) {
    const defaultTemplate = "{method}{path}";
    if (!methodName) {
        return defaultTemplate;
    }
    const hasMethodNameOperationId = /(\{operationId\})/i.test(methodName);
    if (hasMethodNameOperationId) {
        return operationId ? methodName : defaultTemplate;
    }
    return methodName;
}
const TYPES = {
    integer: "number",
    number: "number",
    boolean: "boolean",
    object: "object",
    string: "string",
    array: "array",
    null: "null",
};
function getDefineParam(name, required = false, schema, config, description) {
    return getParamString(name, required, getTsType(schema, config, undefined), description);
}
function getParamString(name, required = false, type, description, isPartial) {
    return `${getJsdoc({
        description,
    })}${name}${required ? "" : "?"}: ${isPartial ? `Partial<${type}>` : type}`;
}
/**
 * Handles reference types ($ref) and returns appropriate TypeScript type
 *
 * @param $ref - The reference string
 * @returns TypeScript type for the reference
 */
function handleRefType($ref) {
    const refArray = $ref.split("/");
    if (refArray[refArray.length - 2] === "requestBodies") {
        return `RequestBody${getRefName($ref)}`;
    }
    return getRefName($ref);
}
/**
 * Handles enum types and returns a union type string
 *
 * @param enumValues - Array of enum values
 * @returns TypeScript union type string
 */
function handleEnumType(enumValues) {
    return enumValues.map((e) => JSON.stringify(e)).join(" | ");
}
/**
 * Handles array types
 *
 * @param items - The items schema for the array
 * @param config - Configuration object
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @returns TypeScript array type string
 */
function handleArrayType(items, config, schemasMap) {
    return `(${getTsType(items, config, schemasMap)})[]`;
}
/**
 * Handles object types with properties
 *
 * @param properties - Object properties
 * @param required - Required property names
 * @param config - Configuration object
 * @param discriminator - Optional discriminator information
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @returns TypeScript object type string
 */
function handleObjectProperties(properties, required, config, discriminator, schemasMap) {
    return getObjectType(Object.entries(properties).map(([pName, _schema]) => {
        var _a;
        let schema = Object.assign(Object.assign({}, _schema), { optional: !((_a = required === null || required === void 0 ? void 0 : required.includes(pName)) !== null && _a !== void 0 ? _a : false) });
        // If this is a discriminator property, use the mapping keys as a union type
        // and make it required (not nullable)
        if (discriminator &&
            pName === discriminator.propertyName &&
            discriminator.mapping) {
            const discriminatorValues = Object.keys(discriminator.mapping);
            schema = Object.assign(Object.assign({}, schema), { optional: false, enum: discriminatorValues });
        }
        return {
            schema,
            name: pName,
        };
    }), config, schemasMap);
}
/**
 * Handles oneOf schema compositions
 *
 * @param oneOf - Array of schemas for oneOf
 * @param result - Existing result string
 * @param config - Configuration object
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @returns Updated result string
 */
function handleOneOfType(oneOf, result, config, schemasMap) {
    const unionTypes = oneOf
        .map((t) => `(${getTsType(t, config, schemasMap)})`)
        .join(" | ");
    return `${result} & (${unionTypes})`;
}
/**
 * Handles allOf schema compositions
 *
 * @param allOf - Array of schemas for allOf
 * @param result - Existing result string
 * @param config - Configuration object
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @param currentTypeName - Optional current type name for discriminator
 *   resolution
 * @returns Updated result string
 */
function handleAllOfType(allOf, result, config, schemasMap, currentTypeName) {
    var _a;
    const intersectionTypes = allOf
        .map((_schema) => getTsType(_schema, config, schemasMap))
        .join(" & ");
    let allOfResult = `${result ? `${result} &` : ""}(${intersectionTypes})`;
    // Check if any of the allOf schemas has a discriminator
    // If so, and we have a currentTypeName, add the discriminator literal type
    if (schemasMap && currentTypeName) {
        for (const schema of allOf) {
            if (schema.$ref) {
                const refName = getRefName(schema.$ref);
                const refSchema = schemasMap.get(refName);
                if ((_a = refSchema === null || refSchema === void 0 ? void 0 : refSchema.discriminator) === null || _a === void 0 ? void 0 : _a.mapping) {
                    // Find which discriminator value maps to the current type
                    const discriminatorEntry = Object.entries(refSchema.discriminator.mapping).find(([, refPath]) => getRefName(refPath) === currentTypeName);
                    if (discriminatorEntry) {
                        const [discriminatorValue] = discriminatorEntry;
                        const discriminatorProp = refSchema.discriminator.propertyName;
                        // Add the discriminator property with literal type
                        allOfResult = `{${discriminatorProp}: '${discriminatorValue}'} & ${allOfResult}`;
                    }
                }
            }
        }
    }
    return allOfResult;
}
/**
 * Handles anyOf schema compositions
 *
 * @param anyOf - Array of schemas for anyOf
 * @param result - Existing result string
 * @param config - Configuration object
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @returns Updated result string
 */
function handleAnyOfType(anyOf, result, config, schemasMap) {
    const unionTypes = anyOf
        .map((_schema) => getTsType(_schema, config, schemasMap))
        .join(" | ");
    return `${result ? `${result} |` : ""}(${unionTypes})`;
}
/**
 * Handles basic object types without specific properties
 *
 * @param additionalProperties - Additional properties schema or boolean
 * @param config - Configuration object
 * @returns TypeScript object type string
 */
function handleBasicObjectType(additionalProperties, config) {
    if (additionalProperties) {
        return `{[x: string]: ${getTsType(additionalProperties, config)}}`;
    }
    return "{[x in string | number ]: any}";
}
/**
 * Main function to convert a schema to TypeScript type
 *
 * @param schema - The schema to convert
 * @param config - Configuration object
 * @param schemasMap - Optional map of all schemas for discriminator resolution
 * @param currentTypeName - Optional current type name for discriminator
 *   resolution
 * @returns TypeScript type string
 */
function getTsType(schema, config, schemasMap, currentTypeName) {
    if (isTypeAny(schema)) {
        return "any";
    }
    const { type, $ref, enum: Enum, items, properties, oneOf, additionalProperties, required, allOf, anyOf, nullable, discriminator, } = schema;
    // Handle reference types
    if ($ref) {
        return handleRefType($ref);
    }
    // Handle enum types
    if (Enum) {
        return handleEnumType(Enum);
    }
    // Handle array types
    if (items) {
        return handleArrayType(items, config, schemasMap);
    }
    let result = "";
    // Handle object properties
    if (properties) {
        result += handleObjectProperties(properties, required, config, discriminator, schemasMap);
    }
    // Handle schema compositions
    if (oneOf) {
        result = handleOneOfType(oneOf, result, config, schemasMap);
    }
    if (allOf) {
        result = handleAllOfType(allOf, result, config, schemasMap, currentTypeName);
    }
    if (anyOf) {
        result = handleAnyOfType(anyOf, result, config, schemasMap);
    }
    // Handle basic object types
    if (type === "object" && !result) {
        return handleBasicObjectType(additionalProperties, config);
    }
    // Handle nullable types
    if (!result && !type && nullable) {
        return "null";
    }
    // Return result or fallback to basic type mapping
    return result || TYPES[type] || "any";
}
function getObjectType(parameter, config, schemasMap) {
    const object = parameter
        .sort(({ name, schema: { optional } = {} }, { name: _name, schema: { optional: _optional } = {} }) => {
        if (!optional && _optional) {
            return -1;
        }
        else if (optional && !_optional) {
            return 1;
        }
        return isAscending(name, _name);
    })
        .reduce((prev, { schema: { deprecated, "x-deprecatedMessage": deprecatedMessage, example, optional, } = {}, schema, name, }) => {
        var _a, _b;
        const nullable = (_b = (_a = schema === null || schema === void 0 ? void 0 : schema.nullable) !== null && _a !== void 0 ? _a : schema === null || schema === void 0 ? void 0 : schema["x-nullable"]) !== null && _b !== void 0 ? _b : false;
        const tsType = getTsType(schema, config, schemasMap);
        const typeWithNullable = nullable &&
            !tsType
                .split("|")
                .map((part) => part.trim())
                .includes("null")
            ? `${tsType} | null`
            : tsType;
        return `${prev}${getJsdoc(Object.assign(Object.assign({}, schema), { deprecated: deprecated || deprecatedMessage ? deprecatedMessage : undefined, example }))}"${name}"${optional ? "?" : ""}: ${typeWithNullable};`;
    }, "");
    return object ? `{${object}}` : "";
}
function getSchemaName(name) {
    ["/", ".", "`", "[", "]", "-", "*", "{", "}"].forEach((str) => {
        name = replaceWithUpper(name, str);
    });
    return name;
}
function getRefName($ref) {
    const parts = $ref.split("/").pop();
    return getSchemaName(parts || "");
}
function getParametersInfo(parameters, type) {
    const params = (parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: location }) => {
        return location === type;
    })) || [];
    return {
        params,
        exist: params.length > 0,
        isNullable: !params.some((parameter) => isParameterRequired(parameter)),
    };
}
function isTypeAny(type) {
    if (type === true) {
        return true;
    }
    if (typeof type === "object" && Object.keys(type).length <= 0) {
        return true;
    }
    if (!type || type.AnyValue) {
        return true;
    }
    return false;
}
/** Used to replace {name} in string with obj.name */
function template(str, obj = {}) {
    Object.entries(obj).forEach(([key, value]) => {
        const re = new RegExp(`{${key}}`, "i");
        str = str.replace(re, value);
    });
    const re = new RegExp("{*}", "g");
    if (re.test(str)) {
        throw new Error(`methodName: Some A key is missed "${str}"`);
    }
    return str;
}
export { getPathParams, getHeaderParams, generateServiceName, getTsType, getRefName, isAscending, getDefineParam, getParamString, getParametersInfo, isTypeAny, template, toPascalCase, getSchemaName, };
//# sourceMappingURL=utils.mjs.map