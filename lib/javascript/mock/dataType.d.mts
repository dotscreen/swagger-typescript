import { Schema } from "../../types.mjs";
export declare enum DataType {
    string = "string",
    number = "number",
    integer = "integer",
    boolean = "boolean",
    array = "array",
    object = "object"
}
export declare namespace DataType {
    function defaultValue(schema: Schema): any;
    function getStringDefaultValue(schema: Schema): string;
}
export declare const isArray: (property: Schema) => property is Schema & {
    items: Schema;
};
export declare const isObject: (schema: Schema) => schema is Schema & {
    type: "object";
};
export declare const isAllOf: (schema: Schema) => schema is Schema & {
    allOf: Schema[];
};
export declare const isOneOf: (schema: Schema) => schema is Schema & {
    oneOf: Schema[];
};
export declare const isAnyOf: (schema: Schema) => schema is Schema & {
    anyOf: Schema[];
};
export declare const isReferenceObject: (schema: Schema) => schema is Schema & {
    $ref: string;
};
//# sourceMappingURL=dataType.d.mts.map