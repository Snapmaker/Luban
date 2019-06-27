import uuid from 'uuid';

export default class GcodeInfo {
    constructor(name, gcode, renderMethod) {
        this.name = name;
        this.gcode = gcode;
        this.renderMethod = renderMethod;
        this.uuid = uuid.v4();
    }

    get uniqueName() {
        return `${this.name}-${this.uuid}`;
    }
}
