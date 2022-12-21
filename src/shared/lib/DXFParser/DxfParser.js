import log from 'loglevel';
import DxfArrayScanner from './DxfArrayScanner';
import AUTO_CAD_COLOR_INDEX from './AutoCadColorIndex';

import Face from './entities/3dface';
import Arc from './entities/arc';
import AttDef from './entities/attdef';
import Circle from './entities/circle';
import Dimension from './entities/dimension';
import Ellipse from './entities/ellipse';
import Insert from './entities/insert';
import Line from './entities/line';
import LWPolyline from './entities/lwpolyline';
import MText from './entities/mtext';
import Point from './entities/point';
import Polyline from './entities/polyline';
import Solid from './entities/solid';
import Spline from './entities/spline';
import Text from './entities/text';

// import Vertex from './entities/';


function registerDefaultEntityHandlers(parser) {
    // Supported entities here (some entity code is still being refactored into this flow)
    parser.registerEntityHandler(Face);
    parser.registerEntityHandler(Arc);
    parser.registerEntityHandler(AttDef);
    parser.registerEntityHandler(Circle);
    parser.registerEntityHandler(Dimension);
    parser.registerEntityHandler(Ellipse);
    parser.registerEntityHandler(Insert);
    parser.registerEntityHandler(Line);
    parser.registerEntityHandler(LWPolyline);
    parser.registerEntityHandler(MText);
    parser.registerEntityHandler(Point);
    parser.registerEntityHandler(Polyline);
    parser.registerEntityHandler(Solid);
    parser.registerEntityHandler(Spline);
    parser.registerEntityHandler(Text);
    // DxfParser.registerEntityHandler(require('./entities/vertex'));
}

export default function DxfParser() {
    this._entityHandlers = {};

    registerDefaultEntityHandlers(this);
}

DxfParser.prototype.parse = function parseparse(source, done) {
    throw new Error('read() not implemented. Use readSync()', source, done);
};

DxfParser.prototype.registerEntityHandler = function registerEntityHandlerregisterEntityHandler(HandlerType) {
    const instance = new HandlerType();
    this._entityHandlers[HandlerType.ForEntityName] = instance;
};

DxfParser.prototype.parseSync = function parseSync(source) {
    if (typeof (source) === 'string') {
        return this._parse(source);
    } else {
        log.error(`Cannot read dxf source of type \`${typeof (source)}`);
        return null;
    }
};

DxfParser.prototype.parseStream = function parseStream(stream, done) {
    let dxfString = '';
    const self = this;
    function onData(chunk) {
        dxfString += chunk;
    }

    function onEnd() {
        let dxf;
        try {
            dxf = self._parse(dxfString);
        } catch (err) {
            return done(err);
        }
        return done(null, dxf);
    }

    function onError(err) {
        done(err);
    }
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
};


const END_OF_TABLE_VALUE = 'ENDTAB';

function debugCode(curr) {
    return `${curr.code}:${curr.value}`;
}

function logUnhandledGroup(curr) {
    log.warn(`unhandled group ${debugCode(curr)}`);
}


/**
 * Returns the truecolor value of the given AutoCad color index value
 * @return {Number} truecolor value as a number
 */
function getAcadColor(index) {
    return AUTO_CAD_COLOR_INDEX[index];
}
DxfParser.prototype._parse = function _parse(dxfString) {
    let curr, lastHandle = 0;
    const dxf = {};
    const dxfLinesArray = dxfString.split(/\r\n|\r|\n/g);

    const scanner = new DxfArrayScanner(dxfLinesArray);
    if (!scanner.hasNext()) throw Error('Empty file');

    const self = this;


    function groupIs(code, value) {
        return curr.code === code && curr.value === value;
    }

    function parseHeader() {
        // interesting variables:
        //  $ACADVER, $VIEWDIR, $VIEWSIZE, $VIEWCTR, $TDCREATE, $TDUPDATE
        // http://www.autodesk.com/techpubs/autocad/acadr14/dxf/header_section_al_u05_c.htm
        // Also see VPORT table entries
        let currVarName = null, currVarValue = null;
        const header = {};
        // loop through header variables
        curr = scanner.next();

        while (true) {
            if (groupIs(0, 'ENDSEC')) {
                if (currVarName) header[currVarName] = currVarValue;
                break;
            } else if (curr.code === 9) {
                if (currVarName) header[currVarName] = currVarValue;
                currVarName = curr.value;
                // Filter here for particular variables we are interested in
            } else {
                if (curr.code === 10) {
                    currVarValue = { x: curr.value };
                } else if (curr.code === 20) {
                    currVarValue.y = curr.value;
                } else if (curr.code === 30) {
                    currVarValue.z = curr.value;
                } else {
                    currVarValue = curr.value;
                }
            }
            curr = scanner.next();
        }
        curr = scanner.next(); // swallow up ENDSEC
        return header;
    }


    function parsePoint() {
        const point = {};
        let code = curr.code;

        point.x = curr.value;

        code += 10;
        curr = scanner.next();
        if (curr.code !== code) {
            throw new Error(`Expected code for point value to be ${code
            } but got ${curr.code}.`);
        }
        point.y = curr.value;

        code += 10;
        curr = scanner.next();
        if (curr.code !== code) {
            scanner.rewind();
            return point;
        }
        point.z = curr.value;

        return point;
    }
    function parseViewPortRecords() {
        const viewPorts = []; // Multiple table entries may have the same name indicating a multiple viewport configuration
        let viewPort = {};

        curr = scanner.next();
        while (!groupIs(0, END_OF_TABLE_VALUE)) {
            switch (curr.code) {
                case 2: // layer name
                    viewPort.name = curr.value;
                    curr = scanner.next();
                    break;
                case 10:
                    viewPort.lowerLeftCorner = parsePoint();
                    curr = scanner.next();
                    break;
                case 11:
                    viewPort.upperRightCorner = parsePoint();
                    curr = scanner.next();
                    break;
                case 12:
                    viewPort.center = parsePoint();
                    curr = scanner.next();
                    break;
                case 13:
                    viewPort.snapBasePoint = parsePoint();
                    curr = scanner.next();
                    break;
                case 14:
                    viewPort.snapSpacing = parsePoint();
                    curr = scanner.next();
                    break;
                case 15:
                    viewPort.gridSpacing = parsePoint();
                    curr = scanner.next();
                    break;
                case 16:
                    viewPort.viewDirectionFromTarget = parsePoint();
                    curr = scanner.next();
                    break;
                case 17:
                    viewPort.viewTarget = parsePoint();
                    curr = scanner.next();
                    break;
                case 42:
                    viewPort.lensLength = curr.value;
                    curr = scanner.next();
                    break;
                case 43:
                    viewPort.frontClippingPlane = curr.value;
                    curr = scanner.next();
                    break;
                case 44:
                    viewPort.backClippingPlane = curr.value;
                    curr = scanner.next();
                    break;
                case 45:
                    viewPort.viewHeight = curr.value;
                    curr = scanner.next();
                    break;
                case 50:
                    viewPort.snapRotationAngle = curr.value;
                    curr = scanner.next();
                    break;
                case 51:
                    viewPort.viewTwistAngle = curr.value;
                    curr = scanner.next();
                    break;
                case 79:
                    viewPort.orthographicType = curr.value;
                    curr = scanner.next();
                    break;
                case 110:
                    viewPort.ucsOrigin = parsePoint();
                    curr = scanner.next();
                    break;
                case 111:
                    viewPort.ucsXAxis = parsePoint();
                    curr = scanner.next();
                    break;
                case 112:
                    viewPort.ucsYAxis = parsePoint();
                    curr = scanner.next();
                    break;
                // case 110:
                //     viewPort.ucsOrigin = parsePoint();
                //     curr = scanner.next();
                //     break;
                // case 281:
                //     viewPort.renderMode = curr.value;
                //     curr = scanner.next();
                //     break;
                case 281:
                    // 0 is one distant light, 1 is two distant lights
                    viewPort.defaultLightingType = curr.value;
                    curr = scanner.next();
                    break;
                case 292:
                    viewPort.defaultLightingOn = curr.value;
                    curr = scanner.next();
                    break;
                case 330:
                    viewPort.ownerHandle = curr.value;
                    curr = scanner.next();
                    break;
                // case 63: // These are all ambient color. Perhaps should be a gradient when multiple are set.
                // case 421:
                case 431:
                    viewPort.ambientColor = curr.value;
                    curr = scanner.next();
                    break;
                case 0:
                    // New ViewPort
                    if (curr.value === 'VPORT') {
                        viewPorts.push(viewPort);
                        viewPort = {};
                        curr = scanner.next();
                    }
                    break;
                default:
                    logUnhandledGroup(curr);
                    curr = scanner.next();
                    break;
            }
        }
        // Note: do not call scanner.next() here,
        //  parseTable() needs the current group
        viewPorts.push(viewPort);

        return viewPorts;
    }
    function parseLineTypes() {
        const ltypes = {};
        let ltypeName,
            ltype = {},
            length;

        curr = scanner.next();
        while (!groupIs(0, 'ENDTAB')) {
            switch (curr.code) {
                case 2:
                    ltype.name = curr.value;
                    ltypeName = curr.value;
                    curr = scanner.next();
                    break;
                case 3:
                    ltype.description = curr.value;
                    curr = scanner.next();
                    break;
                case 73: // Number of elements for this line type (dots, dashes, spaces);
                    length = curr.value;
                    if (length > 0) ltype.pattern = [];
                    curr = scanner.next();
                    break;
                case 40: // total pattern length
                    ltype.patternLength = curr.value;
                    curr = scanner.next();
                    break;
                case 49:
                    ltype.pattern.push(curr.value);
                    curr = scanner.next();
                    break;
                case 0:
                    if (length > 0 && length !== ltype.pattern.length) {
                        log.warn('lengths do not match on LTYPE pattern');
                    }
                    ltypes[ltypeName] = ltype;
                    ltype = {};
                    curr = scanner.next();
                    break;
                default:
                    curr = scanner.next();
            }
        }

        ltypes[ltypeName] = ltype;
        return ltypes;
    }

    function parseLayers() {
        const layers = {};
        let layerName,
            layer = {};

        curr = scanner.next();
        while (!groupIs(0, 'ENDTAB')) {
            switch (curr.code) {
                case 2: // layer name
                    layer.name = curr.value;
                    layerName = curr.value;
                    curr = scanner.next();
                    break;
                case 62: // color, visibility
                    layer.visible = curr.value >= 0;
                    // TODO 0 and 256 are BYBLOCK and BYLAYER respectively. Need to handle these values for layers?.
                    layer.colorIndex = Math.abs(curr.value);
                    layer.color = getAcadColor(layer.colorIndex);
                    curr = scanner.next();
                    break;
                case 70: // frozen layer
                    layer.frozen = ((curr.value & 1) !== 0 || (curr.value & 2) !== 0);
                    curr = scanner.next();
                    break;
                case 0:
                    // New Layer
                    if (curr.value === 'LAYER') {
                        layers[layerName] = layer;
                        layer = {};
                        layerName = undefined;
                        curr = scanner.next();
                    }
                    break;
                default:
                    logUnhandledGroup(curr);
                    curr = scanner.next();
                    break;
            }
        }
        // Note: do not call scanner.next() here,
        //  parseLayerTable() needs the current group
        layers[layerName] = layer;

        return layers;
    }
    const tableDefinitions = {
        VPORT: {
            tableRecordsProperty: 'viewPorts',
            tableName: 'viewPort',
            dxfSymbolName: 'VPORT',
            parseTableRecords: parseViewPortRecords
        },
        LTYPE: {
            tableRecordsProperty: 'lineTypes',
            tableName: 'lineType',
            dxfSymbolName: 'LTYPE',
            parseTableRecords: parseLineTypes
        },
        LAYER: {
            tableRecordsProperty: 'layers',
            tableName: 'layer',
            dxfSymbolName: 'LAYER',
            parseTableRecords: parseLayers
        }
    };
    function parseTable() {
        const tableDefinition = tableDefinitions[curr.value];
        const table = {};
        let expectedCount = 0,
            actualCount;

        curr = scanner.next();
        while (!groupIs(0, END_OF_TABLE_VALUE)) {
            switch (curr.code) {
                case 5:
                    table.handle = curr.value;
                    curr = scanner.next();
                    break;
                case 330:
                    table.ownerHandle = curr.value;
                    curr = scanner.next();
                    break;
                case 100:
                    if (curr.value === 'AcDbSymbolTable') {
                        // ignore
                        curr = scanner.next();
                    } else {
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                    }
                    break;
                case 70:
                    expectedCount = curr.value;
                    curr = scanner.next();
                    break;
                case 0:
                    if (curr.value === tableDefinition.dxfSymbolName) {
                        table[tableDefinition.tableRecordsProperty] = tableDefinition.parseTableRecords();
                    } else {
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                    }
                    break;
                default:
                    logUnhandledGroup(curr);
                    curr = scanner.next();
            }
        }
        const tableRecords = table[tableDefinition.tableRecordsProperty];
        if (tableRecords) {
            if (tableRecords.constructor === Array) {
                actualCount = tableRecords.length;
            } else if (typeof (tableRecords) === 'object') {
                actualCount = Object.keys(tableRecords).length;
            }
            if (expectedCount !== actualCount) {
                log.warn(`Parsed ${actualCount} ${tableDefinition.dxfSymbolName}'s but expected ${expectedCount}`);
            }
        }
        curr = scanner.next();
        return table;
    }

    // /**
    //  * parseTables
    //  * @return {Object} Object representing tables
    //  *
    //  **/


    function parseTables() {
        const tables = {};
        curr = scanner.next();
        while (curr.value !== 'EOF') {
            if (groupIs(0, 'ENDSEC')) break;

            if (groupIs(0, 'TABLE')) {
                curr = scanner.next();

                const tableDefinition = tableDefinitions[curr.value];
                if (tableDefinition) {
                    tables[tableDefinitions[curr.value].tableName] = parseTable();
                }
            } else {
                // else ignored
                curr = scanner.next();
            }
        }

        curr = scanner.next();
        return tables;
    }


    function ensureHandle(entity) {
        if (!entity) throw new TypeError('entity cannot be undefined or null');

        if (!entity.handle) entity.handle = lastHandle++;
    }
    // /**
    //  * Is called after the parser first reads the 0:ENTITIES group. The scanner
    //  * should be on the start of the first entity already.
    //  * @return {Array} the resulting entities
    //  */
    function parseEntities(forBlock) {
        const entities = [];

        const endingOnValue = forBlock ? 'ENDBLK' : 'ENDSEC';

        if (!forBlock) {
            curr = scanner.next();
        }
        while (true) {
            if (curr.code === 0) {
                if (curr.value === endingOnValue) {
                    break;
                }

                let entity;
                const handler = self._entityHandlers[curr.value];
                if (handler !== null && handler !== undefined) {
                    entity = handler.parseEntity(scanner, curr);
                    curr = scanner.lastReadGroup;
                } else {
                    log.warn(`Unhandled entity ${curr.value}`);
                    curr = scanner.next();
                    continue;
                }
                ensureHandle(entity);
                entities.push(entity);
            } else {
                // ignored lines from unsupported entity
                curr = scanner.next();
            }
        }
        if (endingOnValue === 'ENDSEC') curr = scanner.next(); // swallow up ENDSEC, but not ENDBLK
        return entities;
    }
    function parseBlock() {
        const block = {};
        curr = scanner.next();

        while (curr.value !== 'EOF') {
            switch (curr.code) {
                case 1:
                    block.xrefPath = curr.value;
                    curr = scanner.next();
                    break;
                case 2:
                    block.name = curr.value;
                    curr = scanner.next();
                    break;
                case 3:
                    block.name2 = curr.value;
                    curr = scanner.next();
                    break;
                case 5:
                    block.handle = curr.value;
                    curr = scanner.next();
                    break;
                case 8:
                    block.layer = curr.value;
                    curr = scanner.next();
                    break;
                case 10:
                    block.position = parsePoint();
                    curr = scanner.next();
                    break;
                case 67:
                    block.paperSpace = !!((curr.value && curr.value === 1));
                    curr = scanner.next();
                    break;
                case 70:
                    if (curr.value !== 0) {
                        // if(curr.value & BLOCK_ANONYMOUS_FLAG) log.log('  Anonymous block');
                        // if(curr.value & BLOCK_NON_CONSTANT_FLAG) log.log('  Non-constant attributes');
                        // if(curr.value & BLOCK_XREF_FLAG) log.log('  Is xref');
                        // if(curr.value & BLOCK_XREF_OVERLAY_FLAG) log.log('  Is xref overlay');
                        // if(curr.value & BLOCK_EXTERNALLY_DEPENDENT_FLAG) log.log('  Is externally dependent');
                        // if(curr.value & BLOCK_RESOLVED_OR_DEPENDENT_FLAG) log.log('  Is resolved xref or dependent of an xref');
                        // if(curr.value & BLOCK_REFERENCED_XREF) log.log('  This definition is a referenced xref');
                        block.type = curr.value;
                    }
                    curr = scanner.next();
                    break;
                case 100:
                    // ignore class markers
                    curr = scanner.next();
                    break;
                case 330:
                    block.ownerHandle = curr.value;
                    curr = scanner.next();
                    break;
                case 0:
                    if (curr.value === 'ENDBLK') break;
                    block.entities = parseEntities(true);
                    break;
                default:
                    logUnhandledGroup(curr);
                    curr = scanner.next();
            }

            if (groupIs(0, 'ENDBLK')) {
                curr = scanner.next();
                break;
            }
        }
        return block;
    }
    // /**
    //  * Parses a 2D or 3D point, returning it as an object with x, y, and
    //  * (sometimes) z property if it is 3D. It is assumed the current group
    //  * is x of the point being read in, and scanner.next() will return the
    //  * y. The parser will determine if there is a z point automatically.
    //  * @return {Object} The 2D or 3D point as an object with x, y[, z]
    //  */


    function parseBlocks() {
        const blocks = {};
        let block;

        curr = scanner.next();

        while (curr.value !== 'EOF') {
            if (groupIs(0, 'ENDSEC')) {
                break;
            }

            if (groupIs(0, 'BLOCK')) {
                block = parseBlock();
                ensureHandle(block);
                if (!block.name) log.error(`block with handle "${block.handle}" is missing a name.`);
                else blocks[block.name] = block;
            } else {
                logUnhandledGroup(curr);
                curr = scanner.next();
            }
        }
        return blocks;
    }
    function parseAll() {
        curr = scanner.next();
        while (!scanner.isEOF()) {
            if (curr.code === 0 && curr.value === 'SECTION') {
                curr = scanner.next();

                // Be sure we are reading a section code
                if (curr.code !== 2) {
                    log.error('Unexpected code %s after 0:SECTION', debugCode(curr));
                    curr = scanner.next();
                    continue;
                }

                if (curr.value === 'HEADER') {
                    dxf.header = parseHeader();
                } else if (curr.value === 'BLOCKS') {
                    dxf.blocks = parseBlocks();
                } else if (curr.value === 'ENTITIES') {
                    dxf.entities = parseEntities(false);
                } else if (curr.value === 'TABLES') {
                    dxf.tables = parseTables();
                } else if (curr.value === 'EOF') {
                    log.warn('EOF');
                } else {
                    log.warn('Skipping section \'%s\'', curr.value);
                }
            } else {
                curr = scanner.next();
            }
            // If is a new section
        }
    }
    parseAll();
    return dxf;
};

// const BLOCK_ANONYMOUS_FLAG = 1;
// const BLOCK_NON_CONSTANT_FLAG = 2;
// const BLOCK_XREF_FLAG = 4;
// const BLOCK_XREF_OVERLAY_FLAG = 8;
// const BLOCK_EXTERNALLY_DEPENDENT_FLAG = 16;
// const BLOCK_RESOLVED_OR_DEPENDENT_FLAG = 32;
// const BLOCK_REFERENCED_XREF = 64;


/* Notes */
// Code 6 of an entity indicates inheritance of properties (eg. color).
//   BYBLOCK means inherits from block
//   BYLAYER (default) mean inherits from layer
