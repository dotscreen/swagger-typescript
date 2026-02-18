import { writeFileSync, existsSync, readFileSync, rmdirSync } from "fs";
import { format } from "prettier";
import { generator } from "./generator.mjs";
import { build } from "tsc-prog";
import { signalRGenerator } from "./signalR/generator.mjs";
import { generateMock } from "./mock/index.mjs";
import chalk from "chalk";
//@ts-ignore
import recursive from "recursive-readdir";
import { getJson } from "../getJson.mjs";
import getConfigFile from "./files/config.mjs";
import getHttpRequestFile from "./files/httpRequest.mjs";
import getHooksConfigFile from "./files/hooksConfig.mjs";
import { getPrettierOptions } from "../utils.mjs";
const generateJavascriptService = async (config, input) => {
    var _a, _b;
    try {
        const { dir, language, mock, reactHooks } = config;
        const isToJs = language === "javascript";
        // Generate code
        const { code, hooks, type } = generator(input, config);
        if (mock) {
            generateMock(input, config);
        }
        // Write core files
        await writeFile(dir, "services.ts", code, config);
        await writeFile(dir, "types.ts", type, config);
        // Write React hooks if enabled
        if (reactHooks && hooks) {
            await writeFile(dir, "hooks.ts", hooks, config);
            await writeFileIfNotExists(dir, "hooksConfig", isToJs, getHooksConfigFile(), config);
        }
        // Write config files
        await writeFile(dir, "httpRequest.ts", getHttpRequestFile(), config);
        await writeFileIfNotExists(dir, "config", isToJs, getConfigFile({ baseUrl: ((_b = (_a = input.servers) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.url) || "" }), config);
        // Generate SignalR hub if configured
        const hubCode = await generateHub(config);
        // Convert TypeScript to JavaScript if needed
        if (isToJs) {
            const filesToConvert = buildFileList(config, Boolean(reactHooks), Boolean(hubCode));
            convertTsToJs(dir, filesToConvert);
            await formatAllFiles(dir, getPrettierOptions(config));
        }
        // Format all generated files
        console.log(chalk.greenBright("All Completed"));
    }
    catch (error) {
        console.log(chalk.redBright(error), chalk.redBright("Generation failed"));
    }
};
/** Write a file and log completion */
async function writeFile(dir, filename, content, config) {
    writeFileSync(`${dir}/${filename}`, await format(content, getPrettierOptions(config)));
    const name = filename.replace(/\.(ts|js)$/, "");
    console.log(chalk.yellowBright(`${name} Completed`));
}
/** Write a file only if it doesn't already exist */
async function writeFileIfNotExists(dir, basename, isJs, content, config) {
    const ext = isJs ? "js" : "ts";
    const filepath = `${dir}/${basename}.${ext}`;
    if (!existsSync(filepath)) {
        writeFileSync(`${dir}/${basename}.ts`, await format(content, getPrettierOptions(config)));
        console.log(chalk.yellowBright(`${basename} Completed`));
    }
}
/** Generate SignalR hub code if configured */
async function generateHub(config) {
    if (!config.hub) {
        return null;
    }
    const hubJson = await getJson(config.hub);
    const hubCode = signalRGenerator(hubJson, config);
    if (hubCode) {
        writeFile(config.dir, "hub.ts", hubCode, config);
    }
    return hubCode;
}
/** Build list of files to convert from TypeScript to JavaScript */
function buildFileList(config, includeHooks, includeHub) {
    const files = [];
    if (includeHub) {
        files.push("hub");
    }
    if (config.url || config.local) {
        files.push("httpRequest", "services", "types", "config");
        if (includeHooks) {
            files.push("hooks", "hooksConfig");
        }
    }
    return files;
}
/** Format a single file with Prettier */
async function formatFile(filePath, prettierOptions) {
    const code = readFileSync(filePath).toString();
    writeFileSync(filePath, await format(code, prettierOptions));
}
/** Format all files in directory */
async function formatAllFiles(dir, prettierOptions) {
    recursive(dir, async (err, files) => {
        if (err) {
            console.log(chalk.redBright(err));
            return;
        }
        for (const file of files) {
            const options = file.endsWith(".json")
                ? Object.assign(Object.assign({}, prettierOptions), { parser: "json" }) : prettierOptions;
            if (file.endsWith(".ts") ||
                file.endsWith(".js") ||
                file.endsWith(".json")) {
                await formatFile(file, options);
            }
        }
    });
}
/** Convert TypeScript files to JavaScript */
function convertTsToJs(dir, files) {
    build({
        basePath: ".",
        compilerOptions: {
            listFiles: true,
            outDir: dir,
            declaration: true,
            skipLibCheck: true,
            module: "esnext",
            target: "esnext",
            lib: ["esnext"],
        },
        files: files.map((file) => `${dir}/${file}.ts`),
    });
    // Remove original .ts files after conversion
    files.forEach((file) => {
        const tsFile = `${dir}/${file}.ts`;
        if (existsSync(tsFile)) {
            rmdirSync(tsFile, { recursive: true });
        }
    });
}
export { generateJavascriptService };
//# sourceMappingURL=index.mjs.map