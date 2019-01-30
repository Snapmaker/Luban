const TOKEN_COMMENT = 'C';
const TOKEN_EMPTY_LINE = 'N';

// tool path format: https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/266174545/tool+path
// modelInfo format: https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/255459386/laser+cnc
class GcodeParser {
    constructor() {
        this.data = [];
    }

    parseGcodeToToolPathObj(fakeGcode, modelInfo) {
        if (!fakeGcode || !modelInfo) {
            return null;
        }
        if (!['cnc', 'laser', '3dp'].includes(modelInfo.type)) {
            return null;
        }

        const { type, mode, transformation, config } = modelInfo;
        const { translateX, translateY, translateZ } = transformation;

        const lines = fakeGcode.split('\n');
        for (let i = 0, l = lines.length; i < l; i++) {
            this.parseLine(lines[i].trim());
        }

        return {
            type: type,
            mode: mode,
            movementMode: (type === 'laser' && mode === 'greyscale') ? config.movementMode : '',
            data: this.data,
            translateX: translateX,
            translateY: translateY,
            translateZ: translateZ
        };
    }

    parseLine(line) {
        // do not ignore empty string
        if (line.length === 0) {
            const emptyStrObj = {};
            emptyStrObj[TOKEN_EMPTY_LINE] = ' ';
            this.data.push(emptyStrObj);
            return;
        }

        const lineObject = {};
        let comment = null;
        let cmdData = null;
        const commentIndex = line.indexOf(';');

        if (commentIndex !== -1) {
            cmdData = line.substring(0, commentIndex);
            comment = line.substring(commentIndex);
        } else {
            cmdData = line;
        }

        if (cmdData) {
            const tokens = cmdData.trim().split(' ');
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const cmdType = token.substring(0, 1);
                let value = parseFloat(token.substring(1, token.length));
                if (Number.isNaN(value)) {
                    value = token.substring(1, token.length);
                }
                lineObject[cmdType] = value;
            }
        }
        comment && (lineObject[TOKEN_COMMENT] = comment);

        this.data.push(lineObject);
    }
}

export default GcodeParser;
