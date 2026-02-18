import { getSchemaData } from "./parse.mjs";
export const extractSchemas = (obj) => {
    const { components } = obj;
    const schemas = components && components.schemas ? components.schemas : {};
    return Object.keys(schemas).reduce((acc, name) => {
        acc[name] = getSchemaData(schemas, name);
        return acc;
    }, {});
};
//# sourceMappingURL=schema.mjs.map