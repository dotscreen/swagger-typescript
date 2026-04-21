import { getJsdoc } from "../utilities/jsdoc.mjs";
import { isAscending } from "../utils.mjs";
function getPathParams(parameters) {
    return ((parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: In }) => {
        return In === "path";
    })) || []);
}
function isParameterRequired(parameter) {
    return parameter.required === true;
}
function getHeaderParams(parameters, config) {
    const params = (parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: In, name }) => {
        var _a, _b;
        return In === "header" && !((_b = (_a = config.ignore) === null || _a === void 0 ? void 0 : _a.headerParams) === null || _b === void 0 ? void 0 : _b.includes(name));
    })) || [];
    return {
        params,
        isNullable: params.every((parameter) => !isParameterRequired(parameter)),
    };
}
function toPascalCase(str) {
    return `${str.substring(0, 1).toUpperCase()}${str.substring(1)}`;
}
function toCamelCase(str) {
    const schemaName = getSchemaName(str);
    return `${schemaName.substring(0, 1).toLowerCase()}${schemaName.substring(1)}`;
}
function replaceWithUpper(str, sp) {
    let pointArray = str.split(sp);
    pointArray = pointArray.map((point) => toPascalCase(point));
    return pointArray.join("");
}
function generateServiceName(endPoint, method, operationId, config) {
    const { methodName, prefix = "" } = config;
    const _endPoint = endPoint.replace(new RegExp(`^${prefix}`, "i"), "");
    const path = getSchemaName(_endPoint);
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
    integer: "Int",
    number: "Long",
    boolean: "Boolean",
    object: "Any",
    string: "String",
    array: "List<Any>",
};
function getDefineParam(name, required = false, schema, config, description, schemasMap) {
    const type = getKotlinType(schema, config, schemasMap);
    return `${getJsdoc({
        description,
    })}@Path(${JSON.stringify(name)}) ${toCamelCase(name)}: ${appendNullable(type, !required || isSchemaNullable(schema, schemasMap))}`;
}
function getDefinitionBody(name, required = false, schema, config, description, schemasMap) {
    const type = getKotlinType(schema, config, schemasMap);
    return `${getJsdoc({
        description,
    })}@Body ${name}: ${appendNullable(type, !required || isSchemaNullable(schema, schemasMap))}`;
}
function isSchemaMarkedNullable(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.nullable) === true || (schema === null || schema === void 0 ? void 0 : schema["x-nullable"]) === true;
}
function resolveReferencedSchema($ref, schemasMap, visitedRefs = new Set()) {
    if (!schemasMap) {
        return undefined;
    }
    const refName = getRefName($ref);
    const referencedSchema = schemasMap.get(refName);
    if (!(referencedSchema === null || referencedSchema === void 0 ? void 0 : referencedSchema.$ref)) {
        return referencedSchema;
    }
    if (visitedRefs.has(referencedSchema.$ref)) {
        return referencedSchema;
    }
    const nextVisitedRefs = new Set(visitedRefs);
    nextVisitedRefs.add(referencedSchema.$ref);
    return resolveReferencedSchema(referencedSchema.$ref, schemasMap, nextVisitedRefs);
}
function isSchemaNullable(schema, schemasMap, visitedRefs = new Set()) {
    if (!schema) {
        return false;
    }
    if (isSchemaMarkedNullable(schema)) {
        return true;
    }
    if (schema.$ref) {
        if (visitedRefs.has(schema.$ref)) {
            return false;
        }
        const nextVisitedRefs = new Set(visitedRefs);
        nextVisitedRefs.add(schema.$ref);
        return isSchemaNullable(resolveReferencedSchema(schema.$ref, schemasMap, nextVisitedRefs), schemasMap, nextVisitedRefs);
    }
    return false;
}
function appendNullable(type, nullable) {
    return nullable && !type.endsWith("?") ? `${type}?` : type;
}
function getHeaderParamString(name, required = false, type, description) {
    return `${
    //   getJsdoc({
    //   description,
    // })
    ""}@Header(${JSON.stringify(name)}) ${toCamelCase(name)}: ${appendNullable(type, !required)}`;
}
function getQueryParamString(name, required = false, type, description, isPartial) {
    return `${
    //   getJsdoc({
    //   description,
    // })
    ""}@Query(${JSON.stringify(name)}) ${toCamelCase(name)}: ${appendNullable(type, !required)}`;
}
//x-nullable
function normalizeObjectPropertyNullable(propertyName, schema, required) {
    if (schema.nullable !== undefined) {
        return schema.nullable;
    }
    if (schema["x-nullable"] !== undefined) {
        return schema["x-nullable"];
    }
    if (required) {
        return !required.includes(propertyName);
    }
    return true;
}
function getClassBody(schema, config, schemasMap) {
    if (isTypeAny(schema)) {
        return "Any";
    }
    const { properties, required } = schema;
    if (properties) {
        return getObjectType(Object.entries(properties).map(([pName, _schema]) => ({
            schema: Object.assign(Object.assign({}, _schema), { nullable: normalizeObjectPropertyNullable(pName, _schema, required) ||
                    isSchemaNullable(_schema, schemasMap) }),
            name: pName,
        })), config, schemasMap);
    }
    return "Any";
}
function getKotlinType(schema, config, schemasMap) {
    if (isTypeAny(schema)) {
        return "Any";
    }
    const { type, $ref, enum: Enum, items, properties, oneOf, additionalProperties, required, allOf, } = schema;
    const schemaNullable = isSchemaNullable(schema, schemasMap);
    if ($ref) {
        const refArray = $ref.split("/");
        if (refArray[refArray.length - 2] === "requestBodies") {
            return appendNullable(`RequestBody${getRefName($ref)}`, schemaNullable);
        }
        else {
            return appendNullable(getRefName($ref), schemaNullable);
        }
    }
    if (Enum) {
        return "String";
        // return `${Enum.map((t) => `"${t}"`).join(" | ")}`;
    }
    if (items) {
        return appendNullable(`List<${getKotlinType(items, config, schemasMap)}>`, schemaNullable);
    }
    let result = "";
    if (properties) {
        result = "Any";
    }
    if (oneOf) {
        result = "Any";
        // result = `${result} & (${oneOf
        //   .map((t) => `(${getTsType(t, config)})`)
        //   .join(" | ")})`;
    }
    if (allOf) {
        result = "Any";
        // result = `${result} & (${allOf
        //   .map((_schema) => getTsType(_schema, config))
        //   .join(" & ")})`;
    }
    if (type === "object" && !result) {
        // if (additionalProperties) {
        //   return `{[x: string]: ${getTsType(additionalProperties, config)}}`;
        // }
        return "Any";
    }
    return appendNullable(result || TYPES[type], schemaNullable);
}
function getObjectType(parameter, config, schemasMap) {
    const object = parameter
        .sort(({ name, schema: { nullable } = {} }, { name: _name, schema: { nullable: _nullable } = {} }) => {
        if (!nullable && _nullable) {
            return -1;
        }
        else if (nullable && !_nullable) {
            return 1;
        }
        return isAscending(name, _name);
    })
        .reduce((prev, { schema: { deprecated, "x-deprecatedMessage": deprecatedMessage, example, nullable, } = {}, schema, name, }) => {
        const jsdoc = getJsdoc(Object.assign(Object.assign({}, schema), { deprecated: deprecated || deprecatedMessage ? deprecatedMessage : undefined, example }));
        return `${prev
            ? `
  ${prev}`
            : ""}${jsdoc}
  val ${name}: ${appendNullable(getKotlinType(schema, config, schemasMap), Boolean(nullable))},`;
    }, "");
    return object;
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
    const params = (parameters === null || parameters === void 0 ? void 0 : parameters.filter(({ in: In }) => {
        return In === type;
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
export { getPathParams, getHeaderParams, generateServiceName, getKotlinType, getClassBody, isSchemaNullable, getRefName, isAscending, getDefineParam, getQueryParamString, getParametersInfo, isTypeAny, template, toPascalCase, getSchemaName, getDefinitionBody, getHeaderParamString, toCamelCase, };
//# sourceMappingURL=utils.mjs.map