import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generate } from "../lib/index.mjs";
import { cleanOutputDir, generator } from "./main/utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const jsOutputDir = "./__tests__/outputs/nullable-ref";
const kotlinOutputDir = path.join(rootDir, "__tests__/outputs/kotlin-nullable-ref");

const swaggerJson = {
  openapi: "3.0.0",
  info: {
    title: "Nullable ref test",
    version: "1.0.0",
  },
  paths: {
    "/nullable": {
      post: {
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/NullableNode",
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
                  $ref: "#/components/schemas/NullableNode",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      NullableNode: {
        type: "object",
        nullable: true,
        properties: {
          id: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
      LegacyNullableNode: {
        type: "object",
        "x-nullable": true,
        properties: {
          id: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
      Container: {
        type: "object",
        required: ["node", "legacyNode"],
        properties: {
          node: {
            $ref: "#/components/schemas/NullableNode",
          },
          legacyNode: {
            $ref: "#/components/schemas/LegacyNullableNode",
          },
        },
        additionalProperties: false,
      },
    },
  },
};

describe("nullable referenced schemas", () => {
  beforeEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await cleanOutputDir(jsOutputDir);
    await fs.rm(kotlinOutputDir, { recursive: true, force: true });
  });

  test("propagates nullable refs in generated TypeScript types and services", async () => {
    const { "services.ts": code, "types.ts": type } = await generator(
      {
        url: `${jsOutputDir}/swagger.json`,
        dir: jsOutputDir,
      },
      swaggerJson,
    );

    expect(type).toMatch(/export interface Container[\s\S]*node: NullableNode \| null;/);
    expect(type).toMatch(
      /export interface Container[\s\S]*legacyNode: LegacyNullableNode \| null;/,
    );
    expect(code).toContain("requestBody: NullableNode | null");
    expect(code).toContain("Promise<SwaggerResponse<NullableNode | null>>");
  });

  test("propagates nullable refs in generated Kotlin models and services", async () => {
    const swaggerPath = path.join(kotlinOutputDir, "swagger.json");

    await fs.mkdir(kotlinOutputDir, { recursive: true });
    await fs.writeFile(swaggerPath, JSON.stringify(swaggerJson, null, 2));

    await generate({
      url: swaggerPath,
      dir: kotlinOutputDir,
      language: "kotlin",
      kotlinPackage: "com.example.nullable",
    });

    const models = await fs.readFile(path.join(kotlinOutputDir, "Models.kt"), "utf8");
    const services = await fs.readFile(path.join(kotlinOutputDir, "IApis.kt"), "utf8");

    expect(models).toContain("val node: NullableNode?,");
    expect(models).toContain("val legacyNode: LegacyNullableNode?,");
    expect(services).toContain("@Body requestBody: NullableNode?");
    expect(services).toContain("Response<NullableNode?>");
  });
});
