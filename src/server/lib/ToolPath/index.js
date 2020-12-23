import _ from 'lodash';
import { isEqual, isZero, round } from '../../../shared/lib/utils';

// Temporarily prevent the rotation axis motor from losing steps
const MAX_B_SPEED = 2400;

class ToolPath {
    constructor(options = {}) {
        const { isRotate, diameter } = options;
        this.boundingBox = {
            max: {
                x: null,
                y: null,
                z: 0,
                b: null
            },
            min: {
                x: null,
                y: null,
                z: 0,
                b: null
            }
        };
        this.estimatedTime = 0;
        this.isRotate = isRotate;
        this.diameter = diameter;
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

    getState() {
        return this.state;
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

    setMove0F(f) {
        const moveRate = this.setMoveRate(f);
        if (moveRate) {
            this.commands.push({ 'G': 0, F: moveRate });
        }
    }

    setMove1F(f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        if (rapidMoveRate) {
            this.commands.push({ 'G': 1, F: rapidMoveRate });
        }
    }

    move0X(x, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, X: x, F: moveRate } : { 'G': 0, X: x };
        this.setCommand(commandObj);
    }

    move0Y(y, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, Y: y, F: moveRate } : { 'G': 0, Y: y };
        this.setCommand(commandObj);
    }

    move0Z(z, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, Z: z, F: moveRate } : { 'G': 0, Z: z };
        this.setCommand(commandObj);
    }

    move0B(b, f) {
        const moveRate = this.setMoveRate(this.toRotateF(b - this.state.B, 0, 0, 0, f));
        const commandObj = moveRate ? { 'G': 0, B: b, F: moveRate } : { 'G': 0, B: b };
        this.setCommand(commandObj);
    }

    move0XY(x, y, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, X: x, Y: y, F: moveRate } : { 'G': 0, X: x, Y: y };
        this.setCommand(commandObj);
    }

    move0XZ(x, z, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, X: x, Z: z, F: moveRate } : { 'G': 0, X: x, Z: z };
        this.setCommand(commandObj);
    }

    move0BY(b, y, f) {
        const moveRate = this.setMoveRate(this.toRotateF(b - this.state.B, 0, y - this.state.Y, 0, f));
        const commandObj = moveRate ? { 'G': 0, B: b, Y: y, F: moveRate } : { 'G': 0, B: b, Y: y };
        this.setCommand(commandObj);
    }

    move0XZB(x, z, b, f) {
        const moveRate = this.setMoveRate(this.toRotateF(b - this.state.B, x - this.state.X, 0, z - this.state.Z, f));
        const commandObj = moveRate ? { 'G': 0, X: x, Z: z, B: b, F: moveRate } : { 'G': 0, X: x, Z: z, B: b };
        this.setCommand(commandObj);
    }

    move0XYZ(x, y, z, f) {
        const moveRate = this.setMoveRate(f);
        const commandObj = moveRate ? { 'G': 0, X: x, Y: y, Z: z, F: moveRate } : { 'G': 0, X: x, Y: y, Z: z };
        this.setCommand(commandObj);
    }

    move1X(x, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, F: rapidMoveRate } : { 'G': 1, X: x };
        this.setCommand(commandObj);
    }

    move1B(b, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, 0, 0, 0, f));
        const commandObj = rapidMoveRate ? { 'G': 1, B: b, F: rapidMoveRate } : { 'G': 1, B: b };
        this.setCommand(commandObj);
    }

    move1Y(y, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, Y: y, F: rapidMoveRate } : { 'G': 1, Y: y };
        this.setCommand(commandObj);
    }

    move1Z(z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, Z: z, F: f } : { 'G': 1, Z: z };
        this.setCommand(commandObj);
    }

    move1XY(x, y, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, Y: y, F: rapidMoveRate } : { 'G': 1, X: x, Y: y };
        this.setCommand(commandObj);
    }

    move1BY(b, y, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, 0, y - this.state.Y, 0, f));
        const commandObj = rapidMoveRate ? { 'G': 1, B: b, Y: y, F: rapidMoveRate } : { 'G': 1, B: b, Y: y };
        this.setCommand(commandObj);
    }


    move1XZ(x, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, Z: z, F: rapidMoveRate } : { 'G': 1, X: x, Z: z };
        this.setCommand(commandObj);
    }


    move1YZ(y, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, Y: y, Z: z };
        this.setCommand(commandObj);
    }

    move1BZ(b, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, 0, 0, z - this.state.Z, f));
        const commandObj = rapidMoveRate ? { 'G': 1, B: b, Z: z, F: rapidMoveRate } : { 'G': 1, B: b, Z: z };
        this.setCommand(commandObj);
    }

    move1XYZ(x, y, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(f);
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, X: x, Y: y, Z: z };
        this.setCommand(commandObj);
    }

    move1BYZ(b, y, z, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, 0, y - this.state.Y, z - this.state.Z, f));
        const commandObj = rapidMoveRate ? { 'G': 1, B: b, Y: y, Z: z, F: rapidMoveRate } : { 'G': 1, B: b, Y: y, Z: z };
        this.setCommand(commandObj);
    }

    move1XZB(x, z, b, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, x - this.state.X, 0, z - this.state.Z, f));
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, Z: z, B: b, F: rapidMoveRate } : { 'G': 1, X: x, Z: z, B: b };
        this.setCommand(commandObj);
    }

    move1XYZB(x, y, z, b, f) {
        const rapidMoveRate = this.setRapidMoveRate(this.toRotateF(b - this.state.B, x - this.state.X, y - this.state.Y, z - this.state.Z, f));
        const commandObj = rapidMoveRate ? { 'G': 1, X: x, Y: y, Z: z, B: b, F: rapidMoveRate } : { 'G': 1, X: x, Y: y, Z: z, B: b };
        this.setCommand(commandObj);
    }

    // safeStart(x, y, stopHeight, safetyHeight) {
    //     this.commands.push({ G: 90 });
    //     this.commands.push({ G: 0, Z: stopHeight, F: 400 });
    //     if (this.isRotate) {
    //         this.commands.push({ G: 0, B: this.toB(x), Y: y, F: 400 });
    //     } else {
    //         this.commands.push({ G: 0, X: x, Y: y, F: 400 });
    //     }
    //     this.commands.push({ G: 0, Z: safetyHeight, F: 400 });
    // }

    setN() {
        this.commands.push({ 'N': ' ' });
    }

    setComment(comment) {
        this.commands.push({ 'C': comment });
    }

    toB(x) {
        const b = x / this.diameter / Math.PI * 360;
        return round(b, 2);
    }

    toRotateF(db = 0, dx = 0, dy = 0, dz = 0, f) {
        if (db === 0 || this.diameter === 0) {
            return f;
        }
        if (dx === 0 && dy === 0 && dz === 0) {
            return Math.round(f * 360 / Math.PI / this.diameter);
        }
        const s = db * db + dx * dx + dy * dy + dz * dz;
        const ns = (db * Math.PI * this.diameter / 360) * (db * Math.PI * this.diameter / 360) + dx * dx + dy * dy + dz * dz;
        const nf = Math.round(Math.sqrt(s / ns) * f);
        return Math.min(nf, MAX_B_SPEED);
    }

    spindleOn(options = {}) {
        this.commands.push({ M: 3, ...options });
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
                if (commandObj.S) {
                    this.estimatedTime += commandObj.S;
                }
                if (commandObj.P) {
                    this.estimatedTime += commandObj.P / 1000;
                }
            }
            if (commandObj.G === 1 || commandObj.G === 0) {
                const newDirection = this.getDirection(commandObj);
                if (newDirection) {
                    this.estimatedTime += newDirection.lineLength * 60 / (commandObj.G === 0 ? this.state.moveRate : this.state.rapidMoveRate);
                }
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

            if (commandObj.B !== undefined) {
                if (boundingBox.min.b === null) {
                    boundingBox.min.b = commandObj.B;
                } else {
                    boundingBox.min.b = Math.min(boundingBox.min.b, commandObj.B);
                }
                if (boundingBox.max.b === null) {
                    boundingBox.max.b = commandObj.B;
                } else {
                    boundingBox.max.b = Math.max(boundingBox.max.b, commandObj.B);
                }
            }
        }
    }

    setDirection(newDirection) {
        if (newDirection && this.state.direction) {
            const { X, Y, Z, B } = this.state.direction;
            if (isEqual(X, newDirection.X) && isEqual(Y, newDirection.Y) && isEqual(Z, newDirection.Z) && isEqual(B, newDirection.B)) {
                return true;
            }
        }
        this.state.direction = newDirection;
        return false;
    }

    getDirection(commandObj) {
        const { X, Y, Z, B } = commandObj;
        const dx = !_.isNaN(X - this.state.X) ? X - this.state.X : 0;
        const dy = !_.isNaN(Y - this.state.Y) ? Y - this.state.Y : 0;
        const dz = !_.isNaN(Z - this.state.Z) ? Z - this.state.Z : 0;
        const db = !_.isNaN(B - this.state.B) ? B - this.state.B : 0;
        const lineLength = Math.sqrt(dx * dx + dy * dy + dz * dz + db * db);
        if (isZero(lineLength)) {
            return null;
        } else {
            return {
                X: dx / lineLength,
                Y: dy / lineLength,
                Z: dz / lineLength,
                B: db / lineLength,
                lineLength: lineLength
            };
        }
    }

    getLastCommand() {
        return this.commands.length > 0 ? this.commands[this.commands.length - 1] : null;
    }
}

export default ToolPath;
