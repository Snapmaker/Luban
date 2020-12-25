const ASYNC_TIME = 1000;

/**
 *  for(let i = start, i <= end, i+= interval) { func(i) };
 */
export const asyncFor = (start, end, interval = 1, func, asyncTime = ASYNC_TIME, setTime = 20) => {
    asyncTime = Math.max(asyncTime, 100);
    let d = new Date().getTime();
    const order = start < end;

    return new Promise((resolve, reject) => {
        const res = [];
        const asyncFunc = (index) => {
            while (order ? index <= end : index >= end) {
                func(index);

                index += interval;

                const now = new Date().getTime();
                if (now - d > asyncTime) {
                    d = now;
                    break;
                }
            }
            if (order ? index > end : index < end) {
                resolve(res);
            } else {
                setTimeout(() => {
                    asyncFunc(index);
                }, setTime);
            }
        };

        try {
            setTimeout(() => {
                asyncFunc(start);
            }, 0);
        } catch (e) {
            reject(e);
        }
    });
};
