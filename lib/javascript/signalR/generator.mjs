import { generateTypes } from "../generateTypes.mjs";
import { getDefineParam } from "../utils.mjs";
function signalRGenerator(json, config) {
    const types = [];
    const hubs = [];
    try {
        Object.values(json.hubs).map((hub) => {
            const operations = [];
            const callbacks = [];
            Object.entries(hub.operations).map(
            //@ts-ignore
            ([_name, operation]) => {
                operations.push({
                    name: _name,
                    parameters: operation.parameters,
                    description: operation.description,
                });
            });
            Object.entries(hub.callbacks).map(
            //@ts-ignore
            ([_name, operation]) => {
                callbacks.push({
                    name: _name,
                    parameters: operation.parameters,
                    description: operation.description,
                });
            });
            hubs.push({
                name: hub.name,
                operations,
                callbacks,
            });
        });
        if (json.definitions) {
            types.push(...Object.entries(json.definitions).map(([name, schema]) => {
                return {
                    name,
                    schema,
                };
            }));
        }
        let code = "";
        hubs.map(({ name: hubsName, operations, callbacks }) => {
            const operationEnumsName = `${hubsName}OperationsNames`;
            const operationEnums = operations
                .map(({ name: operationKey }) => `${operationKey} = "${operationKey}"`)
                .join(",\n");
            if (operationEnums) {
                code += `
          export enum ${operationEnumsName} {
            ${operationEnums}
            }\n`;
                code += `
          export type ${hubsName}Operations = {
            ${operations
                    .map(({ name, parameters }) => `[${operationEnumsName}.${name}]: (${Object.entries(parameters).map(([_name, schema]) => getDefineParam(_name, schema.required, schema, config, schema.description))}) => Promise<void>`)
                    .join(";\n")}
            };\n`;
            }
            const callbackEnumsName = `${hubsName}CallbacksNames`;
            const callbackEnums = callbacks
                .map(({ name: callbackKey }) => `${callbackKey} = "${callbackKey}"`)
                .join(",\n");
            if (callbackEnums) {
                code += `
          export enum ${callbackEnumsName} {
            ${callbackEnums}
            }\n`;
                code += `
          export type ${hubsName}Callbacks = {
            ${callbacks
                    .map(({ name, parameters }) => `[${callbackEnumsName}.${name}]: (${Object.entries(parameters).map(([_name, schema]) => getDefineParam(_name, schema.required, schema, config, schema.description))}) => void`)
                    .join(";\n")}
            };\n`;
            }
            code += `
      export interface ${hubsName} {
        ${callbackEnums
                ? `
          callbacksName: ${callbackEnumsName};
          callbacks: ${hubsName}Callbacks;
        `
                : ""}
        ${operationEnums
                ? `
          methodsName: ${operationEnumsName};
          methods: ${hubsName}Operations;
        `
                : ""}
      }
      `;
        });
        code += generateTypes(types, config);
        return code;
    }
    catch (error) {
        console.error({ error });
        return "";
    }
}
export { signalRGenerator };
//# sourceMappingURL=generator.mjs.map