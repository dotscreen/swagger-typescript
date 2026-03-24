import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generate } from "../lib/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(
  rootDir,
  "__tests__/outputs/kotlin-optional-params",
);

const swaggerJson = {
  openapi: "3.0.0",
  info: {
    title: "Kotlin optional params test",
    version: "1.0.0",
  },
  paths: {
    "/search": {
      get: {
        parameters: [
          {
            name: "filters",
            in: "query",
            required: false,
            schema: {
              type: "object",
              properties: {
                term: {
                  type: "string",
                },
              },
              required: ["term"],
            },
          },
        ],
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

describe("kotlin optional parameters", () => {
  beforeEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  test("keeps optional query params optional in kotlin services", async () => {
    const swaggerPath = path.join(outputDir, "swagger.json");

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(swaggerPath, JSON.stringify(swaggerJson, null, 2));

    await generate({
      url: swaggerPath,
      dir: outputDir,
      language: "kotlin",
      kotlinPackage: "com.example.test",
    });

    const code = await fs.readFile(path.join(outputDir, "IApis.kt"), "utf8");

    expect(code).toContain('@Query("filters") filters: Any?');
  });
});
