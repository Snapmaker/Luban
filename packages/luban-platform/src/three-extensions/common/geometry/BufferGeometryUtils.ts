import { BufferAttribute, BufferGeometry } from 'three';


/**
 * @param {BufferGeometry} geometry
 * @param {number} tolerance
 * @return {BufferGeometry}
 *
 * https://github.com/mrdoob/three.js/blob/4843e710b333b8d23cf011751130b089d597471c/examples/jsm/utils/BufferGeometryUtils.js#L569
 */
function mergeVertices(geometry, tolerance = 1e-4): BufferGeometry {
    tolerance = Math.max(tolerance, Number.EPSILON);

    // Generate an index buffer if the geometry doesn't have one, or optimize it
    // if it's already available.
    const hashToIndex = {};
    const indices = geometry.getIndex();
    const positions = geometry.getAttribute('position');
    const vertexCount = indices ? indices.count : positions.count;

    // next value for triangle indices
    let nextIndex = 0;

    // attributes and new attribute arrays
    const attributeNames = Object.keys(geometry.attributes);
    const tmpAttributes = {};
    const tmpMorphAttributes = {};
    const newIndices = [];
    const getters = ['getX', 'getY', 'getZ', 'getW'];
    const setters = ['setX', 'setY', 'setZ', 'setW'];

    // Initialize the arrays, allocating space conservatively. Extra
    // space will be trimmed in the last step.
    for (let i = 0, l = attributeNames.length; i < l; i++) {
        const name = attributeNames[i];
        const attr = geometry.attributes[name];

        tmpAttributes[name] = new BufferAttribute(
            new attr.array.constructor(attr.count * attr.itemSize),
            attr.itemSize,
            attr.normalized
        );

        const morphAttr = geometry.morphAttributes[name];
        if (morphAttr) {
            tmpMorphAttributes[name] = new BufferAttribute(
                new morphAttr.array.constructor(morphAttr.count * morphAttr.itemSize),
                morphAttr.itemSize,
                morphAttr.normalized
            );
        }
    }

    // convert the error tolerance to an amount of decimal places to truncate to
    const decimalShift = Math.log10(1 / tolerance);
    const shiftMultiplier = 10 ** decimalShift;
    for (let i = 0; i < vertexCount; i++) {
        const index = indices ? indices.getX(i) : i;

        // Generate a hash for the vertex attributes at the current index 'i'
        let hash = '';
        for (let j = 0, l = attributeNames.length; j < l; j++) {
            const name = attributeNames[j];
            if (name === 'position') {
                const attribute = geometry.getAttribute(name);
                const itemSize = attribute.itemSize;

                for (let k = 0; k < itemSize; k++) {
                    // double tilde truncates the decimal value
                    hash += `${~~(attribute[getters[k]](index) * shiftMultiplier)},`;
                }
            }
        }

        // Add another reference to the vertex if it's already
        // used by another index
        if (hash in hashToIndex) {
            newIndices.push(hashToIndex[hash]);
        } else {
            // copy data to the new index in the temporary attributes
            for (let j = 0, l = attributeNames.length; j < l; j++) {
                const name = attributeNames[j];
                const attribute = geometry.getAttribute(name);
                const morphAttr = geometry.morphAttributes[name];
                const itemSize = attribute.itemSize;
                const newarray = tmpAttributes[name];
                const newMorphArrays = tmpMorphAttributes[name];

                for (let k = 0; k < itemSize; k++) {
                    const getterFunc = getters[k];
                    const setterFunc = setters[k];
                    newarray[setterFunc](nextIndex, attribute[getterFunc](index));

                    if (morphAttr) {
                        for (let m = 0, ml = morphAttr.length; m < ml; m++) {
                            newMorphArrays[m][setterFunc](nextIndex, morphAttr[m][getterFunc](index));
                        }
                    }
                }
            }

            hashToIndex[hash] = nextIndex;
            newIndices.push(nextIndex);
            nextIndex++;
        }
    }

    // generate result BufferGeometry
    const result = geometry.clone();
    for (const name of Object.keys(geometry.attributes)) {
        const tmpAttribute = tmpAttributes[name];

        result.setAttribute(name, new BufferAttribute(
            tmpAttribute.array.slice(0, nextIndex * tmpAttribute.itemSize),
            tmpAttribute.itemSize,
            tmpAttribute.normalized,
        ));

        if (!(name in tmpMorphAttributes)) continue;

        for (let j = 0; j < tmpMorphAttributes[name].length; j++) {
            const tmpMorphAttribute = tmpMorphAttributes[name][j];

            result.morphAttributes[name][j] = new BufferAttribute(
                tmpMorphAttribute.array.slice(0, nextIndex * tmpMorphAttribute.itemSize),
                tmpMorphAttribute.itemSize,
                tmpMorphAttribute.normalized,
            );
        }
    }

    // indices
    result.setIndex(newIndices);

    return result;
}

export {
    mergeVertices
};
