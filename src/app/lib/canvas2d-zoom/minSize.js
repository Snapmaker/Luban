/* eslint-disable */

export class MinimumSizeUtils {
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/rect
    static rect(minWidth, minHeight, args, trafo) {
        const widthFactor = (trafo === null || trafo === void 0 ? void 0 : trafo.a) || 1;
        const heightFactor = (trafo === null || trafo === void 0 ? void 0 : trafo.d) || 1;
        const width = args[2];
        const transformedWidth = width * widthFactor;
        const height = args[3];
        const transformedHeight = height * heightFactor;
        if (transformedWidth >= minWidth && transformedHeight >= minHeight)
            return args;
        const newArgs = Array.from(args);
        if (transformedWidth < minWidth) {
            newArgs[2] = minWidth / widthFactor;
        }
        if (transformedHeight < minHeight) {
            newArgs[3] = minHeight / heightFactor;
        }
        return newArgs;
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arc
    static arc(minRadius, args, trafo) {
        const radius = args[2];
        const factor = ((trafo === null || trafo === void 0 ? void 0 : trafo.a) || 1);
        const transformedRadius = factor * radius;
        if (transformedRadius >= minRadius)
            return args;
        const newArgs = Array.from(args);
        newArgs[2] = minRadius / factor;
        return newArgs;
    }
}
