const TOKEN_COMMENT = 'C';
const TOKEN_EMPTY_LINE = 'N';
const TRANSLATION_DEFAULT = {
    x: 0,
    y: 0,
    z: 0
};

class GcodeParser {
    constructor() {
        this.data = [];
    }

    parseGcodeToToolPathObj(gcodeStr, type = '', processMode = '', translation = TRANSLATION_DEFAULT, params) {
        if (!['cnc', 'laser', '3dp'].includes(type)) {
            return null;
        }

        const lines = gcodeStr.split('\n');
        for (let i = 0, l = lines.length; i < l; i++) {
            this.parseLine(lines[i].trim());
        }

        const toolPathObject = {
            metadata: {
                type: type,
                mode: processMode
            },
            data: this.data,
            params: params,
            translation: translation
        };
        return toolPathObject;
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
