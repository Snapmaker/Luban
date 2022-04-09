export const camelCaseToUnderScoreCase = (str: string) => {
    if (str) {
        return str.split('').map((char, i) => {
            if (char >= 'A' && char <= 'Z') {
                if (i > 0) {
                    return `_${char.toLowerCase()}`;
                } else {
                    return char.toLocaleLowerCase();
                }
            }
            return char;
        }).join('');
    }
    return str;
};

export const convertObjectKeyNameToUnderScoreCase = (obj: Object) => {
    const keys = Object.keys(obj);
    const objWithNewKeys = {};
    keys.forEach(key => {
        if (typeof obj[key] !== 'object') {
            objWithNewKeys[camelCaseToUnderScoreCase(key)] = obj[key];
        } else {
            objWithNewKeys[camelCaseToUnderScoreCase(key)] = convertObjectKeyNameToUnderScoreCase(obj[key]);
        }
    });
    return objWithNewKeys;
};
