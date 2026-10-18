// Electron getBounds() returns outer window bounds. Keep that frame on restore
// and fit even same-display bounds: resolution, scaling and panels can change.
const getWindowBounds = (display, saved = null) => {
    const area = display.workArea;
    const minWidth = Math.min(1024, area.width);
    const minHeight = Math.min(708, area.height);
    const savedWidth = Number.isFinite(saved?.width) ? saved.width : 1440;
    const savedHeight = Number.isFinite(saved?.height) ? saved.height : 900;
    const width = Math.min(area.width, Math.max(minWidth, savedWidth));
    const height = Math.min(area.height, Math.max(minHeight, savedHeight));
    const sameDisplay = saved?.id === display.id;
    const x = sameDisplay && Number.isFinite(saved.x) ? saved.x : area.x + (area.width - width) / 2;
    const y = sameDisplay && Number.isFinite(saved.y) ? saved.y : area.y + (area.height - height) / 2;

    return {
        id: display.id,
        x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
        y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
        width,
        height,
        minWidth,
        minHeight,
        useContentSize: false,
    };
};

export default getWindowBounds;
