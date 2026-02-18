import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { getJson } from "./getJson.mjs";
import { generateJavascriptService } from "./javascript/index.mjs";
import { getCurrentUrl, getPrettierOptions, majorVersionsCheck, } from "./utils.mjs";
import { swaggerToOpenApi } from "./utilities/swaggerToOpenApi.mjs";
import chalk from "chalk";
import { partialUpdateJson } from "./updateJson.mjs";
import { default as postmanToOpenApi } from "postman-ke-openapi";
import yaml from "js-yaml";
import path from "path";
import { generateKotlinService } from "./kotlin/index.mjs";
import { format } from "prettier";
/**
 * Main generation function that processes one or multiple swagger
 * configurations
 *
 * @param config - Configuration object or array of configurations. If
 *   undefined, will use swagger.config.json
 * @param cli - CLI options that override file-based configuration
 * @throws Error when configuration is invalid or generation fails
 */
async function generate(config, cli) {
    try {
        const resolvedConfig = config !== null && config !== void 0 ? config : getSwaggerConfig(cli);
        if (!resolvedConfig) {
            throw new Error("Configuration is required for code generation, create a swagger.config.json file");
        }
        const configs = Array.isArray(resolvedConfig)
            ? resolvedConfig
            : [resolvedConfig];
        // Validate each configuration before processing
        for (const singleConfig of configs) {
            validateConfiguration(singleConfig);
        }
        // Process each configuration
        for (const singleConfig of configs) {
            await generateService(singleConfig, cli);
        }
    }
    catch (error) {
        console.error("Generation failed:", error);
        throw error;
    }
}
/**
 * Validates a single configuration object
 *
 * @param config - Configuration to validate
 * @throws Error when configuration is invalid
 */
function validateConfiguration(config) {
    if (!config.dir) {
        throw new Error("Configuration must specify an output directory (dir)");
    }
    if (!config.url) {
        throw new Error("Configuration must specify either 'url' for remote source or local file");
    }
    const validLanguages = ["javascript", "typescript", "kotlin"];
    if (config.language && !validLanguages.includes(config.language)) {
        throw new Error(`Unsupported language: ${config.language}. Supported languages: ${validLanguages.join(", ")}`);
    }
    if (config.language === "kotlin" && !config.kotlinPackage) {
        throw new Error("Kotlin language requires 'kotlinPackage' to be specified");
    }
}
/**
 * Merges file configuration with CLI configuration
 *
 * @param fileConfig - Configuration from file
 * @param cli - CLI configuration overrides
 * @returns Merged configuration
 */
function mergeConfigurations(fileConfig, cli) {
    var _a, _b, _c;
    return Object.assign(Object.assign({}, fileConfig), { tag: (_a = cli === null || cli === void 0 ? void 0 : cli.tag) !== null && _a !== void 0 ? _a : fileConfig.tag, local: (_b = cli === null || cli === void 0 ? void 0 : cli.local) !== null && _b !== void 0 ? _b : fileConfig.local, branch: (_c = cli === null || cli === void 0 ? void 0 : cli.branch) !== null && _c !== void 0 ? _c : fileConfig.branch, config: cli === null || cli === void 0 ? void 0 : cli.config });
}
/**
 * Ensures the output directory exists
 *
 * @param dir - Directory path to create if it doesn't exist
 */
function ensureOutputDirectory(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
/**
 * Fetches and processes JSON data from URL or local file
 *
 * @param config - Configuration object
 * @returns Processed SwaggerJson object
 */
async function fetchAndProcessJson(config) {
    const { url, local, dir } = config;
    if (local) {
        return getLocalJson(dir);
    }
    if (!url) {
        throw new Error("Add url in swagger.config.json ");
    }
    const resolvedUrl = typeof url === "string" ? url : await getCurrentUrl(config);
    const input = await getJson(resolvedUrl);
    return normalizeJsonFormat(input);
}
/**
 * Normalizes different JSON formats to OpenAPI v3
 *
 * @param input - Input JSON in various formats
 * @returns Normalized SwaggerJson object
 */
async function normalizeJsonFormat(input) {
    if (input.swagger) {
        majorVersionsCheck("2.0.0", input.swagger);
        return await swaggerToOpenApi(input);
    }
    if (input.openapi) {
        majorVersionsCheck("3.0.0", input.openapi);
        return input;
    }
    // Handle Postman collections
    return yaml.load(await postmanToOpenApi(JSON.stringify(input), undefined));
}
/**
 * Handles JSON persistence based on configuration
 *
 * @param config - Configuration object
 * @param input - JSON data to persist
 * @param swaggerJsonPath - Path to save the JSON file
 * @returns Updated JSON data (if partial update was performed)
 */
async function handleJsonPersistence(config, input, swaggerJsonPath) {
    var _a;
    if (!config.keepJson) {
        return input;
    }
    try {
        if (!((_a = config.tag) === null || _a === void 0 ? void 0 : _a.length)) {
            writeFileSync(swaggerJsonPath, await format(JSON.stringify(input), getPrettierOptions(config)));
            return input;
        }
        const oldJson = getLocalJson(config.dir);
        const updatedInput = partialUpdateJson(oldJson, input, config.tag);
        writeFileSync(swaggerJsonPath, JSON.stringify(updatedInput));
        return updatedInput;
    }
    catch (error) {
        console.log(chalk.red("keepJson failed"), chalk.red(error));
        return input;
    }
}
/**
 * Dispatches to appropriate language-specific generator
 *
 * @param config - Configuration object
 * @param input - Processed JSON data
 */
async function dispatchToGenerator(config, input) {
    switch (config.language) {
        case "kotlin":
            await generateKotlinService(config, input);
            break;
        default:
            await generateJavascriptService(config, input);
            break;
    }
}
/**
 * Main service generation function with improved separation of concerns
 *
 * @param fileConfig - File-based configuration
 * @param cli - CLI configuration overrides
 */
const generateService = async (fileConfig, cli) => {
    try {
        console.log(chalk.blueBright(`Start ${fileConfig.dir} generation...`));
        const config = mergeConfigurations(fileConfig, cli);
        ensureOutputDirectory(config.dir);
        const swaggerJsonPath = `${config.dir}/swagger.json`;
        let input = await fetchAndProcessJson(config);
        input = await handleJsonPersistence(config, input, swaggerJsonPath);
        await dispatchToGenerator(config, input);
    }
    catch (error) {
        console.log(chalk.redBright(error), chalk.redBright("Generation failed"));
    }
};
function getSwaggerConfig(cli) {
    try {
        const rawPath = (cli === null || cli === void 0 ? void 0 : cli.config) || "swagger.config.json";
        const configPath = rawPath.endsWith(".json")
            ? rawPath
            : path.join(rawPath, "swagger.config.json");
        const fullPath = path.isAbsolute(configPath)
            ? configPath
            : path.join(process.cwd(), configPath);
        console.log(chalk.grey(`Your config path: ${fullPath}`));
        const config = readJson(fullPath);
        return config;
    }
    catch (error) {
        throw new Error("Please define swagger.config.json");
    }
}
function getLocalJson(dir) {
    const swaggerJsonPath = `${dir}/swagger.json`;
    try {
        return readJson(swaggerJsonPath);
    }
    catch (error) {
        console.log(chalk.red("swagger.json file not found. You should set keepJson true to save json then run swag-ts without tag to save that"));
        throw error;
    }
}
function readJson(path) {
    const old = readFileSync(path).toString();
    return JSON.parse(old);
}
export { generate };
//# sourceMappingURL=index.mjs.map