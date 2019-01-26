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

export {
    getTimestamp
};

// TODO: compare k-v rather than JSON.stringify
const compareObjectContent = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};
export default compareObjectContent;
