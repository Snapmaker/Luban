import { useMemo } from 'react';

/**
 * Re-used canvas actions.
 */
export const useCanvasActions = (canvas) => {
    const canvasActions = useMemo(() => {
        const zoomIn = () => {
            canvas.zoomIn();
        };

        const zoomOut = () => {
            canvas.zoomOut();
        };

        return {
            zoomIn,
            zoomOut,
        };
    }, [canvas]);

    return canvasActions;
};

