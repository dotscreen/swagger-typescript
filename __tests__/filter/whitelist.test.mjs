import { cleanOutputDir, generator } from "../main/utils.mjs";
import swaggerJson from "./swagger.json";

describe("whitelistRegex", () => {
  const outputDir = "./__tests__/filter/outputs/whitelist";

  beforeAll(async () => {
    await cleanOutputDir(outputDir);
  });

  afterEach(async () => {
    await cleanOutputDir(outputDir);
  });

  test("filters endpoints and exports only related types", async () => {
    const {
      "services.ts": code,
      "types.ts": type,
      "hooks.ts": hooks,
    } = await generator(
      {
        url: `${outputDir}/swagger.json`,
        dir: outputDir,
        reactHooks: true,
        whitelistRegex: ["^GET /v1\\.0/ui-themes/"],
      },
      swaggerJson,
    );

    expect(code).toContain("export const getV10UiThemesPage");
    expect(code).toContain("export const getV10UiThemesStatusPage");
    expect(code).not.toContain("getV10AdminUiThemesPage");
    expect((hooks.match(/export const use/g) || []).length).toBe(2);

    expect(type).toContain("export interface PageDto");
    expect(type).toContain("export interface MetaDto");
    expect(type).toContain("export interface ErrorResponse");
    expect(type).not.toContain("export interface AddUpdatePageRequest");
    expect(type).not.toContain("export interface ThemeRequest");
  });
});
