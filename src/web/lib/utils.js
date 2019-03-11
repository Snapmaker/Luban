const getTimestamp = () => {
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    const d = new Date();

    return d.getFullYear()
        + pad(d.getMonth() + 1)
        + pad(d.getDate())
        + pad(d.getHours())
        + pad(d.getMinutes())
        + pad(d.getSeconds());
};

/**
 * change mouse event type
 */
const simulateMouseEvent = (e, type) => {
    const event = document.createEvent('MouseEvents');
    const sx = e.screenX;
    const sy = e.screenY;
    const cx = e.clientX;
    const cy = e.clientY;
    event.initMouseEvent(type, true, true, document.defaultView, 0, sx, sy, cx, cy, false, false, false, false, 0, null);
    return event;
};

export {
    getTimestamp,
    simulateMouseEvent
};

// TODO: compare k-v rather than JSON.stringify
const compareObjectContent = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};
export default compareObjectContent;
