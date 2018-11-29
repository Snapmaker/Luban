// todo: compare k-v rather than JSON.stringify
const compareObjectContent = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};

export default compareObjectContent;
