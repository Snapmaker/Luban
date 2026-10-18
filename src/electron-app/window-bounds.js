// Electron 15 on X11 reports client bounds, excluding the window manager's
// decorations, even with useContentSize:false. Its minimum-size hints also
// exclude that frame. Leave room for it on Linux: a 708px minimum plus Ubuntu's
// 37px title bar cannot maximize into a 736px work area. Electron does not expose
// those external frame extents, so reserve a conservative 64px vertically and
// 16px horizontally for restored bounds and minimum-size hints (not max size).
// Fit same-display restores too: resolution, scaling and panels can change.
const getWindowBounds = (display, saved = null, platform = process.platform) => {
    const area = {
        ...display.workArea,
        width: Math.max(1, display.workArea.width - (platform === 'linux' ? 16 : 0)),
        height: Math.max(1, display.workArea.height - (platform === 'linux' ? 64 : 0)),
    };
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
