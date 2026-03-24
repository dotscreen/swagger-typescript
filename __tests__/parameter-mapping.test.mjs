import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generate } from "../lib/index.mjs";
import { cleanOutputDir, generator } from "./main/utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const jsOutputDir = "./__tests__/outputs/parameter-mapping";
const kotlinOutputDir = path.join(
  rootDir,
  "__tests__/outputs/kotlin-parameter-mapping",
);

const swaggerJson = {
  openapi: "3.0.0",
  info: {
    title: "Parameter mapping test",
    version: "1.0.0",
  },
  paths: {
    "/items/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: false,
          schema: {
            type: "string",
          },
        },
        {
          name: "lang",
          in: "query",
          required: false,
          schema: {
            type: "string",
          },
        },
      ],
      get: {
        parameters: [
          {
            name: "lang",
            in: "query",
            required: true,
            schema: {
              type: "integer",
            },
          },
          {
            name: "X-Trace-Id",
            in: "header",
            required: false,
            schema: {
              type: "string",
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

describe("parameter mapping", () => {
  beforeEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  test("enforces required path params and operation-level parameter overrides in javascript", async () => {
    const { "services.ts": code, "types.ts": type } = await generator(
      {
        url: `${jsOutputDir}/swagger.json`,
        dir: jsOutputDir,
      },
      swaggerJson,
    );

    expect(code).toContain("export const getItemsId = (");
    expect(code).toContain("id: string,");
    expect(type).toContain("lang: number;");
    expect(type).not.toContain("lang?: string;");
  });

  test("uses Retrofit query and header annotations with normalized names in kotlin", async () => {
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

    expect(code).toContain('@Path("id") id: String');
    expect(code).toContain('@Query("lang") lang: Int');
    expect(code).toContain('@Header("X-Trace-Id") xTraceId: String?');
  });
});
