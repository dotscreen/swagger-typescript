import * as fs from "fs";
import { join } from "path";
// Replace `{}, /` charactors with `_`
export const normalizePath = (path) => {
    const replaced = path.replace(/^\/|{|}/g, "");
    return replaced.replace(/\//g, "_");
};
export const normalizeName = (name) => {
    return name.toLowerCase().replace(/ /g, "_").replace(/,/g, "");
};
// Write each response to JSON files.
export const writeFiles = (data, outputPath) => {
    Object.keys(data).forEach((key) => {
        const val = data[key];
        const fileName = `${key}.json`;
        const path = join(outputPath, fileName);
        const formatted = JSON.stringify(val, null, 2);
        fs.writeFileSync(path, formatted);
    });
};
//# sourceMappingURL=util.mjs.map