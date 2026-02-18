import { SwaggerConfig, CLIConfig } from "./types.mjs";
/**
 * Main generation function that processes one or multiple swagger
 * configurations
 *
 * @param config - Configuration object or array of configurations. If
 *   undefined, will use swagger.config.json
 * @param cli - CLI options that override file-based configuration
 * @throws Error when configuration is invalid or generation fails
 */
declare function generate(config?: SwaggerConfig, cli?: Partial<CLIConfig>): Promise<void>;
export { generate };
//# sourceMappingURL=index.d.mts.map