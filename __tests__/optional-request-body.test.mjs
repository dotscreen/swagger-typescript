import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generate } from "../lib/index.mjs";
import { cleanOutputDir, generator } from "./main/utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const jsOutputDir = "./__tests__/outputs/optional-request-body";
const kotlinOutputDir = path.join(
  rootDir,
  "__tests__/outputs/kotlin-optional-request-body",
);

const swaggerJson = {
  openapi: "3.0.0",
  info: {
    title: "Optional request body test",
    version: "1.0.0",
  },
  paths: {
    "/submit": {
      post: {
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  },
};

describe("optional request body", () => {
  beforeEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  test("keeps optional request body optional in javascript services and hooks", async () => {
    const { "services.ts": code, "hooks.ts": hooks } = await generator(
      {
        url: `${jsOutputDir}/swagger.json`,
        dir: jsOutputDir,
        reactHooks: true,
      },
      swaggerJson,
    );

    expect(code).toContain("export const postSubmit = (");
    expect(code).toContain("requestBody?: {");
    expect(hooks).toContain("requestBody?: {");
  });

  test("keeps optional request body optional in kotlin services", async () => {
    const swaggerPath = path.join(kotlinOutputDir, "swagger.json");

    await fs.mkdir(kotlinOutputDir, { recursive: true });
    await fs.writeFile(swaggerPath, JSON.stringify(swaggerJson, null, 2));

    await generate({
      url: swaggerPath,
      dir: kotlinOutputDir,
      language: "kotlin",
      kotlinPackage: "com.example.test",
    });

    const code = await fs.readFile(
      path.join(kotlinOutputDir, "IApis.kt"),
      "utf8",
    );

    expect(code).toContain("@Body requestBody: Any?");
  });
});
