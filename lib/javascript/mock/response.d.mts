import { Method, Config, SwaggerJson, SwaggerResponse } from "../../types.mjs";
export declare const APPLICATION_JSON = "application/json";
export type ResponsesType = {
    [path: string]: {
        path: string;
        method: Method;
        response: {
            [status: string]: SwaggerResponse["content"];
        };
    };
};
export declare const extractResponses: (input: SwaggerJson, config: Config) => ResponsesType;
//# sourceMappingURL=response.d.mts.map