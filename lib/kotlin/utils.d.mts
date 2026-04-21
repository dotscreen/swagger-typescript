import { Schema, Parameter, Config } from "../types.mjs";
import { isAscending } from "../utils.mjs";
declare function getPathParams(parameters?: Parameter[]): Parameter[];
declare function getHeaderParams(parameters: Parameter[] | undefined, config: Config): {
    params: Parameter[];
    isNullable: boolean;
};
declare function toPascalCase(str: string): string;
declare function toCamelCase(str: string): string;
declare function generateServiceName(endPoint: string, method: string, operationId: string | undefined, config: Config): string;
declare function getDefineParam(name: string, required: boolean | undefined, schema: Schema | undefined, config: Config, description?: string, schemasMap?: Map<string, Schema>): string;
declare function getDefinitionBody(name: string, required: boolean | undefined, schema: Schema | undefined, config: Config, description?: string, schemasMap?: Map<string, Schema>): string;
declare function isSchemaNullable(schema: Schema | undefined, schemasMap?: Map<string, Schema>, visitedRefs?: Set<string>): boolean;
declare function getHeaderParamString(name: string, required: boolean | undefined, type: string, description?: string): string;
declare function getQueryParamString(name: string, required: boolean | undefined, type: string, description?: string, isPartial?: boolean): string;
declare function getClassBody(schema: undefined | true | {} | Schema, config: Config, schemasMap?: Map<string, Schema>): string;
declare function getKotlinType(schema: undefined | true | {} | Schema, config: Config, schemasMap?: Map<string, Schema>): string;
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
export { getPathParams, getHeaderParams, generateServiceName, getKotlinType, getClassBody, isSchemaNullable, getRefName, isAscending, getDefineParam, getQueryParamString, getParametersInfo, isTypeAny, template, toPascalCase, getSchemaName, getDefinitionBody, getHeaderParamString, toCamelCase, };
//# sourceMappingURL=utils.d.mts.map