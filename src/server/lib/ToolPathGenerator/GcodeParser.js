const TOKEN_COMMENT = 'C';
const TOKEN_EMPTY_LINE = 'N';

// tool path format: https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/266174545/tool+path
// modelInfo format: https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/255459386/laser+cnc
class GcodeParser {
    constructor() {
        this.data = [];
        this.estimatedTime = 0;
    }

    parseGcodeToToolPathObj(fakeGcode, modelInfo) {
        if (!fakeGcode || !modelInfo) {
            return null;
        }
        if (!['cnc', 'laser', '3dp'].includes(modelInfo.headerType)) {
            return null;
        }

        const { headerType, mode, transformation, config, gcodeConfig } = modelInfo;
        const { positionX, positionY, positionZ } = transformation;
        const { jogSpeed, workSpeed, dwellTime } = gcodeConfig;

        const lines = fakeGcode.split('\n');
        const startPoint = {
            X: undefined,
            Y: undefined,
            G: undefined
        };
        const boundingBox = {
            min: {
                x: null,
                y: null,
                z: 0
            },
            max: {
                x: null,
                y: null,
                z: 0
            }
        };
        for (let i = 0; i < lines.length; i++) {
            this.parseLine(lines[i].trim());
            const lineObject = this.data[i];
            if (lineObject.G === 4) {
                this.estimatedTime += dwellTime * 0.001;
            }
            if (lineObject.X !== undefined && lineObject.G !== undefined) {
                switch (lineObject.G) {
                    case 0:
                        this.estimatedTime += this.getLineLength(startPoint, lineObject) * 60.0 / jogSpeed;
                        break;
                    case 1:
                        this.estimatedTime += this.getLineLength(startPoint, lineObject) * 60.0 / workSpeed;
                        break;
                    default:
                }
            }
            lineObject.X !== undefined && (startPoint.X = lineObject.X);
            lineObject.Y !== undefined && (startPoint.Y = lineObject.Y);

            this.setBoundingBox(boundingBox, lineObject);
        }
        boundingBox.max.x += positionX;
        boundingBox.min.x += positionX;
        boundingBox.max.y += positionY;
        boundingBox.min.y += positionY;
        return {
            headerType: headerType,
            mode: mode,
            movementMode: (headerType === 'laser' && mode === 'greyscale') ? config.movementMode : '',
            data: this.data,
            estimatedTime: this.estimatedTime * 1.4,
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ,
            boundingBox: boundingBox
        };
    }

    setBoundingBox(boundingBox, linePoint) {
        if (linePoint.X !== undefined) {
            if (boundingBox.min.x === null) {
                boundingBox.min.x = linePoint.X;
            } else {
                boundingBox.min.x = Math.min(boundingBox.min.x, linePoint.X);
            }
            if (boundingBox.max.x === null) {
                boundingBox.max.x = linePoint.X;
            } else {
                boundingBox.max.x = Math.max(boundingBox.max.x, linePoint.X);
            }
        }

        if (linePoint.Y !== undefined) {
            if (boundingBox.min.y === null) {
                boundingBox.min.y = linePoint.Y;
            } else {
                boundingBox.min.y = Math.min(boundingBox.min.y, linePoint.Y);
            }
            if (boundingBox.max.y === null) {
                boundingBox.max.y = linePoint.Y;
            } else {
                boundingBox.max.y = Math.max(boundingBox.max.y, linePoint.Y);
            }
        }
    }

    getLineLength(startPoint, endPoint) {
        if (((endPoint.X - startPoint.X < 1e-6) && (endPoint.Y - startPoint.Y < 1e-6))
            || startPoint.X === undefined || startPoint.Y === undefined
            || endPoint.X === undefined || endPoint.Y === undefined) {
            return 0;
        }
        return Math.sqrt((endPoint.X - startPoint.X) * (endPoint.X - startPoint.X) + (endPoint.Y - startPoint.Y) * (endPoint.Y - startPoint.Y));
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
