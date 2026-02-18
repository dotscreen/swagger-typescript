import { Schema, Parameter, Config } from "../types.mjs";
import { isAscending } from "../utils.mjs";
declare function getPathParams(parameters?: Parameter[]): Parameter[];
declare function getHeaderParams(parameters: Parameter[] | undefined, config: Config): {
    params: Parameter[];
    isNullable: boolean;
};
declare function toPascalCase(str: string): string;
declare function generateServiceName(endPoint: string, method: string, operationId: string | undefined, config: Config): string;
declare function getDefineParam(name: string, required: boolean | undefined, schema: Schema | undefined, config: Config, description?: string): string;
declare function getDefinitionBody(name: string, schema: Schema | undefined, config: Config, description?: string): string;
declare function getHeaderString(name: string, required: boolean | undefined, type: string, description?: string): string;
declare function getParamString(name: string, required: boolean | undefined, type: string, description?: string, isPartial?: boolean): string;
declare function getClassBody(schema: undefined | true | {} | Schema, config: Config): string;
declare function getKotlinType(schema: undefined | true | {} | Schema, config: Config): string;
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
export { getPathParams, getHeaderParams, generateServiceName, getKotlinType, getClassBody, getRefName, isAscending, getDefineParam, getParamString, getParametersInfo, isTypeAny, template, toPascalCase, getSchemaName, getDefinitionBody, getHeaderString, };
//# sourceMappingURL=utils.d.mts.map