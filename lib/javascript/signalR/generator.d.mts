import type { Schema, Config } from "../../types.mjs";
export interface HubJson {
    SignalrType: string;
    info: {
        title: string;
        termsOfService?: string;
        version: string;
    };
    hubs: {
        [serviceName: string]: {
            name: string;
            operations: {
                [x: string]: Operation;
            };
            callbacks: {
                [x: string]: Operation;
            };
        };
    };
    definitions: {
        [x: string]: Schema;
    };
}
interface Operation {
    parameters: {
        [x: string]: Schema;
    };
    description?: string;
    returntype?: Schema;
}
declare function signalRGenerator(json: HubJson, config: Config): string;
export { signalRGenerator };
//# sourceMappingURL=generator.d.mts.map