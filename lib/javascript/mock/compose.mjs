import { normalizePath } from "./util.mjs";
import { REF, parseObject, parseArray } from "./parse.mjs";
import { isObject, isArray, DataType } from "./dataType.mjs";
import { getRefName } from "../utils.mjs";
// Compose mock data
export const composeMockData = (responses, schemas) => {
    const ret = {};
    Object.keys(responses).forEach((path) => {
        const res = responses[path];
        const pathKey = normalizePath(path);
        let response = "";
        if (!res) {
            return;
        }
        Object.entries(res.response).forEach(([status, content]) => {
            const val = (content === null || content === void 0 ? void 0 : content["application/json"]) ||
                (content === null || content === void 0 ? void 0 : content["application/octet-stream"]) ||
                (content === null || content === void 0 ? void 0 : content["multipart/form-data"]);
            if (!val) {
                return;
            }
            if (val === null || val === void 0 ? void 0 : val.schema) {
                const { schema } = val;
                const ref = schema[REF];
                if (ref) {
                    const schemaName = getRefName(ref);
                    if (schemaName) {
                        response = schemas[schemaName];
                    }
                }
                else {
                    if (isObject(schema)) {
                        response = parseObject(schema, schemas);
                    }
                    else if (isArray(schema)) {
                        response = parseArray(schema, schemas);
                    }
                    else if (schema.properties) {
                        response = schema.properties;
                    }
                    else if (schema.type) {
                        response = DataType.defaultValue(schema);
                    }
                }
            }
            else if (val.example) {
                response = val.example;
            }
            else if (val.examples) {
                const examplesKey = Object.keys(val.examples);
                if (examplesKey.length <= 1) {
                    response = val.examples;
                }
                else {
                    // for (const [key, example] of Object.entries<any>(val.examples)) {
                    //   const extendedPathKey = pathKey + "_" + normalizeName(key);
                    //   response = example["value"];
                    // }
                }
            }
            ret[pathKey] = {
                method: res.method,
                path: res.path,
                response: { [status]: response },
            };
        });
    });
    return ret;
};
//# sourceMappingURL=compose.mjs.map