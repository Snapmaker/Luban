/* eslint-disable */

const bilinear_grid_spacing_virt = [0, 0];
const bilinear_grid_factor_virt = [0, 0];

const WITHIN = (N,L,H) =>       ((N) >= (L) && (N) <= (H))
const NEAR_ZERO = (x) => WITHIN(x, -0.000001, 0.000001)
const RECIPROCAL = (x) => (NEAR_ZERO(x) ? 0 : (1 / (x)))
const LINEAR_EXTRAPOLATION = (E, I) => ((E) * 2 - (I))
const sq = (x) => (x * x)

const X_AXIS = 0
const Y_AXIS = 1
const GRID_MAX_NUM = 11
const BILINEAR_SUBDIVISIONS = 3
const GRID_MAX_POINTS_Y = 3
const GRID_MAX_POINTS_X = 3
const ABL_TEMP_POINTS_X = (GRID_MAX_POINTS_X + 2);
const ABL_TEMP_POINTS_Y = (GRID_MAX_POINTS_Y + 2);
const ABL_GRID_POINTS_VIRT_X = (GRID_MAX_POINTS_X - 1) * (BILINEAR_SUBDIVISIONS) + 1;
const ABL_GRID_POINTS_VIRT_Y = (GRID_MAX_POINTS_Y - 1) * (BILINEAR_SUBDIVISIONS) + 1;

const VIRTUAL_GRID_MAX_NUM = () => ((GRID_MAX_NUM - 1) * BILINEAR_SUBDIVISIONS + 1)


const bilinear_grid_spacing = [0,0]

let z_values = new Array();
for(var x =0;x<GRID_MAX_NUM;x++){
    z_values[x] = new Array()
    for(var y =0;y<GRID_MAX_NUM;y++)
    z_values[x][y] = 0
}

let z_values_virt = new Array();
for(var x =0;x<VIRTUAL_GRID_MAX_NUM();x++) {
    z_values_virt[x] = new Array()
    for(var y =0;y<VIRTUAL_GRID_MAX_NUM();y++)
    z_values_virt[x][y] = 0
}
    






function bed_level_virt_coord(x, y) {
    
    let ep = 0, ip = 1;
    if (!x || x == ABL_TEMP_POINTS_X - 1) {
        if (x) {
            ep = GRID_MAX_POINTS_X - 1;
            ip = GRID_MAX_POINTS_X - 2;
        }
        if (WITHIN(y, 1, ABL_TEMP_POINTS_Y - 2)) {
            return LINEAR_EXTRAPOLATION(
                z_values[ep][y - 1],
                z_values[ip][y - 1]
            );
        } else {
            return LINEAR_EXTRAPOLATION(
                bed_level_virt_coord(ep + 1, y),
                bed_level_virt_coord(ip + 1, y)
            );
        }
    }
    if (!y || y == ABL_TEMP_POINTS_Y - 1) {
        if (y) {
            ep = GRID_MAX_POINTS_Y - 1;
            ip = GRID_MAX_POINTS_Y - 2;
        }
        if (WITHIN(x, 1, ABL_TEMP_POINTS_X - 2)) {
            return LINEAR_EXTRAPOLATION(
                z_values[x - 1][ep],
                z_values[x - 1][ip]
            );
        } else {
            return LINEAR_EXTRAPOLATION(
                bed_level_virt_coord(x, ep + 1),
                bed_level_virt_coord(x, ip + 1)
            );
        }
    }
    return z_values[x - 1][y - 1];
}

function bed_level_virt_cmr(p, i, t) {
    return (
        p[i - 1] * -t * sq(1 - t)
      + p[i] * (2 - 5 * sq(t) + 3 * t * sq(t))
      + p[i + 1] * t * (1 + 4 * t - 3 * sq(t))
      - p[i + 2] * sq(t) * (1 - t)
    ) * 0.5;
}


function bed_level_virt_2cmr(x, y, tx, ty) {
    const row = [], column = [];
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            column[j] = bed_level_virt_coord(i + x - 1, j + y - 1);
        }
        row[i] = bed_level_virt_cmr(column, 1, ty);
    }
    return bed_level_virt_cmr(row, 1, tx);
}



function bed_level_virt_interpolate() {
    bilinear_grid_spacing_virt[X_AXIS] = bilinear_grid_spacing[X_AXIS] / (BILINEAR_SUBDIVISIONS);
    bilinear_grid_spacing_virt[Y_AXIS] = bilinear_grid_spacing[Y_AXIS] / (BILINEAR_SUBDIVISIONS);
    bilinear_grid_factor_virt[X_AXIS] = RECIPROCAL(bilinear_grid_spacing_virt[X_AXIS]);
    bilinear_grid_factor_virt[Y_AXIS] = RECIPROCAL(bilinear_grid_spacing_virt[Y_AXIS]);
    for (let y = 0; y < GRID_MAX_POINTS_Y; y++) {
        for (let x = 0; x < GRID_MAX_POINTS_X; x++) {
            for (let ty = 0; ty < BILINEAR_SUBDIVISIONS; ty++) {
                for (let tx = 0; tx < BILINEAR_SUBDIVISIONS; tx++) {
                    if ((ty && y == GRID_MAX_POINTS_Y - 1) || (tx && x == GRID_MAX_POINTS_X - 1)) continue;
                    z_values_virt[x * (BILINEAR_SUBDIVISIONS) + tx][y * (BILINEAR_SUBDIVISIONS) + ty] = bed_level_virt_2cmr(
                        x + 1,
                        y + 1,
                        tx / (BILINEAR_SUBDIVISIONS),
                        ty / (BILINEAR_SUBDIVISIONS)
                    );
                }
            }
        }
    }
}

 export default 
     function leveling (points,POINT_NUM){
        for(var x =0;x<POINT_NUM;x++){
            for(var y =0;y<POINT_NUM;y++)
                z_values[x][y] = points[x*3 + y]
        }
        for(var x =0;x<VIRTUAL_GRID_MAX_NUM();x++) {
            z_values_virt[x] = new Array()
            for(var y =0;y<VIRTUAL_GRID_MAX_NUM();y++)
                z_values_virt[x][y] = 0
        }
        
        bed_level_virt_interpolate();
        return z_values_virt;
        // let VIRT_POINT_NUM = (POINT_NUM - 1) * 2 + POINT_NUM;
        // let result = []
        // for(var x=0;x < VIRT_POINT_NUM;x++ ){
            
        //     for(var y=0;y<VIRT_POINT_NUM;y++){
        //         result[VIRT_POINT_NUM * x + y] = z_values_virt[x][y]
        //     }
        // }
        
        // return result
    }

