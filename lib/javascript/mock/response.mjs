import { generateServiceName } from "../utils.mjs";
export const APPLICATION_JSON = "application/json";
export const extractResponses = (input, config) => {
    const ret = {};
    Object.entries(input.paths).forEach(([path, value]) => {
        Object.entries(value).forEach(([method, options]) => {
            const { operationId, responses } = options;
            const response = {};
            Object.keys(responses).forEach((statusCode) => {
                const { content } = responses[statusCode];
                response[statusCode] = content;
            });
            const key = generateServiceName(path, method, operationId, config);
            ret[key] = {
                method: method,
                path,
                response,
            };
        });
    });
    return ret;
};
//# sourceMappingURL=response.mjs.map