let guid = 0;
export var DataType;
(function (DataType) {
    DataType["string"] = "string";
    DataType["number"] = "number";
    DataType["integer"] = "integer";
    DataType["boolean"] = "boolean";
    DataType["array"] = "array";
    DataType["object"] = "object";
})(DataType || (DataType = {}));
(function (DataType) {
    function defaultValue(schema) {
        if (schema.example) {
            return schema.example;
        }
        switch (schema.type) {
            case DataType.string:
                return getStringDefaultValue(schema);
            case DataType.number:
            case DataType.integer:
                return schema.minimum || schema.maximum || 0;
            case DataType.boolean:
                return true;
            case DataType.array:
                return [];
            case DataType.object:
                return {};
            default:
                return {};
        }
    }
    DataType.defaultValue = defaultValue;
    function getStringDefaultValue(schema) {
        if (schema.enum) {
            return schema.enum[0];
        }
        if (schema.format) {
            switch (schema.format) {
                case "date":
                    return "2017-07-21";
                case "date-time":
                    return "2017-07-21T17:32:28Z";
                case "password":
                    return "password";
                case "byte":
                    return "U3dhZ2dlciByb2Nrcw==";
                case "binary":
                    return "binary";
                case "binary":
                    return "binary";
                case "guid":
                case "uuid":
                    return `3ba89b92-8c02-4e5a-9843-${guid++}`;
                default:
                    return "";
            }
        }
        // TODO: pattern support
        return "";
    }
    DataType.getStringDefaultValue = getStringDefaultValue;
})(DataType || (DataType = {}));
export const isArray = (property) => {
    return property.type === DataType.array;
};
export const isObject = (schema) => {
    return schema.type === DataType.object || schema.properties !== undefined;
};
export const isAllOf = (schema) => {
    return schema.allOf !== undefined;
};
export const isOneOf = (schema) => {
    return schema.oneOf !== undefined;
};
export const isAnyOf = (schema) => {
    return schema.anyOf !== undefined;
};
export const isReferenceObject = (schema) => {
    return "$ref" in schema;
};
//# sourceMappingURL=dataType.mjs.map