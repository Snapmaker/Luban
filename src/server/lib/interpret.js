import ensureArray from 'ensure-array';
import { parseLine } from '../../shared/lib/gcodeParser';

const fromPairs = (pairs) => {
    let index = -1;
    const length = (!pairs) ? 0 : pairs.length;
    const result = {};

    while (++index < length) {
        const pair = pairs[index];
        result[pair[0]] = pair[1];
    }
    return result;
};

const partitionWordsByGroup = (words = []) => {
    const groups = [];

    for (let i = 0; i < words.length; ++i) {
        const word = words[i];
        const letter = word[0];

        if ((letter === 'G') || (letter === 'M')) {
            groups.push([word]);
        } else if (groups.length > 0) {
            groups[groups.length - 1].push(word);
        } else {
            groups.push([word]);
        }
    }
    return groups;
};

const interpret = (() => {
    let cmd = '';

    return (line, callback) => {
        const data = parseLine(line);
        const groups = partitionWordsByGroup(ensureArray(data.words));

        for (let i = 0; i < groups.length; ++i) {
            const words = groups[i];
            const word = words[0] || [];
            const letter = word[0];
            const arg = word[1];

            if (letter === 'G' || letter === 'M') {
                cmd = letter + arg;
                const params = fromPairs(words.slice(1));
                callback(cmd, params);
            } else if (letter[0] !== ';') {
                const params = fromPairs(words);
                callback(cmd, params);
            }
        }
    };
})();

export default interpret;
