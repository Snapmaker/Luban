import STLExporter from '../../components/three-extensions/STLExporter';
import STLBinaryExporter from '../../components/three-extensions/STLBinaryExporter';
import OBJExporter from '../../components/three-extensions/OBJExporter';

class ModelExporter {
    // default: binary stl
    parse (object3d, format = 'stl', isBinary = true) {
        if (!format) {
            return undefined;
        }
        if (!object3d) {
            return undefined;
        }
        if (!['stl', 'obj'].includes(format)) {
            return undefined;
        }
        if (format === 'stl') {
            if (isBinary) {
                return this.parseToBinaryStl(object3d);
            } else {
                return this.parseToAsciiStl(object3d);
            }
        } else if (format === 'obj') {
            return this.parseToObj(object3d);
        }
        return undefined;
    }
    parseToAsciiStl (object3d) {
        return new STLExporter().parse(object3d);
    }
    parseToBinaryStl (object3d) {
        return new STLBinaryExporter().parse(object3d);
    }
    parseToObj (object3d) {
        return new OBJExporter().parse(object3d);
    }
}

export default ModelExporter;
