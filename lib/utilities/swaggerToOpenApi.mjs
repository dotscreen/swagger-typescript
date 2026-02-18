//@ts-ignore
import converter from "swagger2openapi";
/** Support swagger v2 */
function swaggerToOpenApi(input) {
    const options = {};
    options.patch = true; // fix up small errors in the source definition
    options.warnOnly = true; // Do not throw on non-patchable errors
    return new Promise((resolve, reject) => {
        converter.convertObj(input, options, function (err, result) {
            if (err) {
                reject(err);
                return;
            }
            resolve(result.openapi);
        });
    });
}
export { swaggerToOpenApi };
//# sourceMappingURL=swaggerToOpenApi.mjs.map