import _ from 'lodash';

const EPSILON = 1e-6;

const isEqual = (x, y) => {
    return Math.abs(x - y) < EPSILON;
};

const isZero = (x) => {
    return Math.abs(x) < EPSILON;
};

class ToolPath {
    constructor(options = {}) {
        const { isRotate, radius } = options;
        this.boundingBox = {
            max: {
                x: null,
                y: null,
                z: 0
            },
            min: {
                x: null,
                y: null,
                z: 0
            }
        };
        this.estimatedTime = 0;
        this.isRotate = isRotate;
        this.radius = radius;
    }

    commands = [];

    state = {
        rapidMoveRate: 0,
        moveRate: 0,
        G: null,
        X: 0,
        Y: 0,
        Z: 0,
        B: 0,
        direction: null
    };

    setState(commandObj) {
        !_.isUndefined(commandObj.G) && (this.state.G = commandObj.G);
        !_.isUndefined(commandObj.X) && (this.state.X = commandObj.X);
        !_.isUndefined(commandObj.Y) && (this.state.Y = commandObj.Y);
        !_.isUndefined(commandObj.Z) && (this.state.Z = commandObj.Z);
        !_.isUndefined(commandObj.B) && (this.state.B = commandObj.B);
    }

    setMoveRate(f) {
        if (!!f && f !== this.state.moveRate) {
            this.state.moveRate = f;
            return f;
        }
        return null;
    }

    setRapidMoveRate(f) {
        if (!!f && f !== this.state.rapidMoveRate) {
            this.state.rapidMoveRate = f;
            return f;
        }
        return null;
    }

    move0XYZ(x, y, z, f) {
        const moveRate = this.setMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = moveRate ? { 'G': 0, B: this.toB(x), Y: y, Z: z, F: moveRate } : { 'G': 0, B: this.toB(x), Y: y, Z: z };
        } else {
            commandObj = moveRate ? { 'G': 0, X: x, Y: y, Z: z, F: moveRate } : { 'G': 0, X: x, Y: y, Z: z };
        }

        this.setCommand(commandObj);
    }

    move0XY(x, y, f) {
        const moveRate = this.setMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = moveRate ? { 'G': 0, B: this.toB(x), Y: y, F: moveRate } : { 'G': 0, B: this.toB(x), Y: y };
        } else {
            commandObj = moveRate ? { 'G': 0, X: x, Y: y, F: moveRate } : { 'G': 0, X: x, Y: y };
        }

        this.setCommand(commandObj);
    }

    move0Z(z, f) {
        const moveRate = this.setMoveRate(f);

        const commandObj = moveRate ? { 'G': 0, Z: z, F: moveRate } : { 'G': 0, Z: z };

        this.setCommand(commandObj);
    }

    move1Y(y, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = rapidMoveRate ? { 'G': 1, Y: y, F: rapidMoveRate } : { 'G': 1, Y: y };
        } else {
            commandObj = rapidMoveRate ? { 'G': 1, Y: y, F: rapidMoveRate } : { 'G': 1, Y: y };
        }

        this.setCommand(commandObj);
    }

    move1XY(x, y, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = rapidMoveRate ? { 'G': 1, B: this.toB(x), Y: y, F: rapidMoveRate } : { 'G': 1, B: this.toB(x), Y: y };
        } else {
            commandObj = rapidMoveRate ? { 'G': 1, X: x, Y: y, F: rapidMoveRate } : { 'G': 1, X: x, Y: y };
        }

        this.setCommand(commandObj);
    }

    move1YZ(y, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = rapidMoveRate ? { 'G': 1, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, Y: y, Z: z };
        } else {
            commandObj = rapidMoveRate ? { 'G': 1, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, Y: y, Z: z };
        }

        this.setCommand(commandObj);
    }


    move1XYZ(x, y, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        let commandObj;
        if (this.isRotate) {
            commandObj = rapidMoveRate ? { 'G': 1, B: this.toB(x), Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, B: this.toB(x), Y: y, Z: z };
        } else {
            commandObj = rapidMoveRate ? { 'G': 1, X: x, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, X: x, Y: y, Z: z };
        }

        this.setCommand(commandObj);
    }

    move1Z(z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);

        const commandObj = rapidMoveRate ? { 'G': 1, Z: z, F: f } : { 'G': 1, Z: z };

        this.setCommand(commandObj);
    }

    safeStart(x, y, stopHeight, safetyHeight) {
        this.commands.push({ G: 90 });
        this.commands.push({ G: 0, Z: stopHeight, F: 400 });
        if (this.isRotate) {
            this.commands.push({ G: 0, B: this.toB(x), Y: y, F: 400 });
        } else {
            this.commands.push({ G: 0, X: x, Y: y, F: 400 });
        }
        this.commands.push({ G: 0, Z: safetyHeight, F: 400 });
    }

    toB(x) {
        const d = this.state.Z || this.radius;
        const b = x * (d / this.radius) / (2 * d * Math.PI) * 360;
        return Math.round(b * 100) / 100;
    }

    spindleOn() {
        this.commands.push({ M: 3, P: 100 });
    }

    spindleOff() {
        this.commands.push({ M: 5 });
    }

    setCommand(commandObj) {
        this.setBoundingBox(commandObj);

        if ((commandObj.G === 0 || commandObj.G === 1)
            && commandObj.G === this.state.G && !commandObj.F) {
            const newDirection = this.getDirection(commandObj);

            if (!newDirection) {
                return;
            }

            this.estimatedTime += newDirection.lineLength * 60 / (commandObj.G === 0 ? this.state.moveRate : this.state.rapidMoveRate);

            if (this.setDirection(newDirection)) {
                for (const key of Object.keys(commandObj)) {
                    this.commands[this.commands.length - 1][key] = commandObj[key];
                }
            } else {
                this.commands.push(commandObj);
            }
        } else {
            if (commandObj.G === 4) {
                this.estimatedTime += commandObj.S;
            }
            this.commands.push(commandObj);
            this.setDirection(null);
        }

        this.setState(commandObj);
    }

    setBoundingBox(commandObj) {
        if (commandObj.G === 0 || commandObj.G === 1) {
            const boundingBox = this.boundingBox;
            if (commandObj.X !== undefined) {
                if (boundingBox.min.x === null) {
                    boundingBox.min.x = commandObj.X;
                } else {
                    boundingBox.min.x = Math.min(boundingBox.min.x, commandObj.X);
                }
                if (boundingBox.max.x === null) {
                    boundingBox.max.x = commandObj.X;
                } else {
                    boundingBox.max.x = Math.max(boundingBox.max.x, commandObj.X);
                }
            }

            if (commandObj.Y !== undefined) {
                if (boundingBox.min.y === null) {
                    boundingBox.min.y = commandObj.Y;
                } else {
                    boundingBox.min.y = Math.min(boundingBox.min.y, commandObj.Y);
                }
                if (boundingBox.max.y === null) {
                    boundingBox.max.y = commandObj.Y;
                } else {
                    boundingBox.max.y = Math.max(boundingBox.max.y, commandObj.Y);
                }
            }
        }
    }

    setDirection(newDirection) {
        if (newDirection && this.state.direction) {
            const { X, Y, Z } = this.state.direction;
            if (isEqual(X, newDirection.X) && isEqual(Y, newDirection.Y) && isEqual(Z, newDirection.Z)) {
                return true;
            }
        }
        this.state.direction = newDirection;
        return false;
    }

    getDirection(commandObj) {
        const { X, Y, Z, B } = commandObj;
        let dx = !_.isNaN(X - this.state.X) ? X - this.state.X : 0;
        const dy = !_.isNaN(Y - this.state.Y) ? Y - this.state.Y : 0;
        const dz = !_.isNaN(Z - this.state.Z) ? Z - this.state.Z : 0;
        const db = !_.isNaN(B - this.state.B) ? B - this.state.B : 0;
        if (this.isRotate) {
            dx = db;
        }
        const lineLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (isZero(lineLength)) {
            return null;
        } else {
            return {
                X: dx / lineLength,
                Y: dy / lineLength,
                Z: dz / lineLength,
                lineLength: Math.sqrt(dx * dx + dy * dy + dz * dz)
            };
        }
    }

    getLastCommand() {
        return this.commands.length > 0 ? this.commands[this.commands.length - 1] : null;
    }
}

export default ToolPath;
