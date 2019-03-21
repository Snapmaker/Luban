const printTimeCost = true;
const cost = {
    time: (label) => {
        printTimeCost && console.time(label);
    },
    timeEnd: (label) => {
        printTimeCost && console.timeEnd(label);
    }
};

export default cost;
