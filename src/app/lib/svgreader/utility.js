/* eslint-disable */
export const VertexScale = (v, f) => {
    v[0] *= f;
    v[1] *= f;
};

export const MatrixMult = (mA, mB) => {
    return [ mA[0] * mB[0] + mA[2] * mB[1],
             mA[1] * mB[0] + mA[3] * mB[1],
             mA[0] * mB[2] + mA[2] * mB[3],
             mA[1] * mB[2] + mA[3] * mB[3],
             mA[0] * mB[4] + mA[2] * mB[5] + mA[4],
             mA[1] * mB[4] + mA[3] * mB[5] + mA[5]];
};

export const MatrixApply = (mat, vec) => {
    let vec0 = mat[0] * vec[0] + mat[2] * vec[1] + mat[4];
    vec[1] = mat[1] * vec[0] + mat[3] * vec[1] + mat[5];
    vec[0] = vec0;
    return vec;
};

export const ParseFloats = (floatStrings) => {
    // Conver a list of float strings to an actual list of loats,
    // The function can deal with pretty much any separation chars.
    const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)/g;
    let floats = [];
    let m = null;
    do {
        m = re.exec(floatStrings);
        if (m) {
            floats.push(parseFloat(m[1]));
        }
    } while(m);
    return floats;
};

export const ParseScalar = (scalar_unit_string) => {
    // Parse one scalar string with (optional) unit and return both
    const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)([a-z]*)/g;

    let m = re.exec(scalar_unit_string);
    return [parseFloat(m[1]), m[3]];
};
