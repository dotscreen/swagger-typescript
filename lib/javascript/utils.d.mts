import { Schema, Parameter, Config } from "../types.mjs";
import { isAscending } from "../utils.mjs";
declare function getPathParams(parameters?: Parameter[]): Parameter[];
declare function getHeaderParams(parameters: Parameter[] | undefined, config: Config): {
    params: string;
    isNullable: boolean;
};
/**
 * Converts a string to PascalCase (first letter uppercase)
 *
 * @param str - String to convert
 * @returns PascalCase version of the string
 */
declare function toPascalCase(str: string): string;
/**
 * Generates a service method name based on endpoint, method, and configuration
 *
 * @param endPoint - API endpoint path
 * @param method - HTTP method (GET, POST, etc.)
 * @param operationId - Optional operation ID from OpenAPI spec
 * @param config - Configuration object containing naming rules
 * @returns Generated service method name
 */
declare function generateServiceName(endPoint: string, method: string, operationId: string | undefined, config: Config): string;
declare function getDefineParam(name: string, required: boolean | undefined, schema: Schema | undefined, config: Config, description?: string): string;
declare function getParamString(name: string, required: boolean | undefined, type: string, description?: string, isPartial?: boolean): string;
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
declare function getTsType(schema: undefined | true | {} | Schema, config: Config, schemasMap?: Map<string, Schema>, currentTypeName?: string): string;
declare function getSchemaName(name: string): string;
declare function getRefName($ref: string): string;
declare function getParametersInfo(parameters: Parameter[] | undefined, type: "query" | "header"): {
    params: Parameter[];
    exist: boolean;
    isNullable: boolean;
};
declare function isTypeAny(type: true | undefined | {} | Schema): boolean;
/** Used to replace {name} in string with obj.name */
declare function template(str: string, obj?: {
    [x: string]: string;
}): string;
export { getPathParams, getHeaderParams, generateServiceName, getTsType, getRefName, isAscending, getDefineParam, getParamString, getParametersInfo, isTypeAny, template, toPascalCase, getSchemaName, };
//# sourceMappingURL=utils.d.mts.map