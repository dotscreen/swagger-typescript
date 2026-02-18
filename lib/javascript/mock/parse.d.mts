import { Schema } from "../../types.mjs";
export declare const REF = "$ref";
type Schemas = {
    [schema: string]: Schema;
};
export declare const mergeAllOf: (properties: Schema[], schemas: Schemas) => any;
export declare const pickOneOf: (properties: Schema[], schemas: Schemas) => any;
export declare const getSchemaData: (schemas: Schemas, name: string) => Object;
export declare const parseObject: (obj: Schema, schemas: Schemas) => any;
export declare const parseArray: (arr: Schema & {
    items: Schema;
}, schemas: Schemas) => any;
export {};
//# sourceMappingURL=parse.d.mts.map