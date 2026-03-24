import { cleanOutputDir, generator } from "./main/utils.mjs";

const outputDir = "./__tests__/outputs/optional-params";

const swaggerJson = {
  openapi: "3.0.0",
  info: {
    title: "Optional params test",
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
          {
            name: "x-trace-id",
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

describe("optional parameters", () => {
  beforeEach(async () => {
    await cleanOutputDir(outputDir);
  });

  afterEach(async () => {
    await cleanOutputDir(outputDir);
  });

  test("keeps optional query and header params optional in services", async () => {
    const { "services.ts": code } = await generator(
      {
        url: `${outputDir}/swagger.json`,
        dir: outputDir,
      },
      swaggerJson,
    );

    expect(code).toContain("queryParams?: GetSearchQueryParams");
    expect(code).toContain("headerParams?: {");
    expect(code).toContain('"x-trace-id"?: string');
  });
});
