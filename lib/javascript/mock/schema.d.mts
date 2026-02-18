import { Schema, SwaggerJson } from "../../types.mjs";
export type Schemas = {
    [schema: string]: Schema;
};
export declare const extractSchemas: (obj: SwaggerJson) => Schemas;
//# sourceMappingURL=schema.d.mts.map