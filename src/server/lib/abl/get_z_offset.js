/* eslint-disable */

const WITHIN = (N,L,H) =>       ((N) >= (L) && (N) <= (H))
const NEAR_ZERO = (x) => WITHIN(x, -0.000001, 0.000001)
const RECIPROCAL = (x) => (NEAR_ZERO(x) ? 0 : (1 / (x)))
const LINEAR_EXTRAPOLATION = (E, I) => ((E) * 2 - (I))
const sq = (x) => (x * x)
const constrain = (amt,low,high) => ((amt)<(low)?(low):((amt)>(high)?(high):(amt)))
const FLOOR = (x) => Math.floor(x)


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
const ABL_BG_POINTS_X =  ABL_GRID_POINTS_VIRT_X
const ABL_BG_POINTS_Y =  ABL_GRID_POINTS_VIRT_Y

// Get the Z adjustz_offsetment for non-linear bed leveling
function bilinear_z_offset( raw, GRID_MAX_POINTS, rect, z_values_virt ) {
    const GRID_MAX_POINTS_Y = GRID_MAX_POINTS
    const GRID_MAX_POINTS_X = GRID_MAX_POINTS
    const {startx, endx,starty, endy} = rect
    let bilinear_grid_spacing = []
    let bilinear_start = []
    bilinear_grid_spacing[X_AXIS] = (endx - startx) / (GRID_MAX_POINTS_X - 1);
    bilinear_grid_spacing[Y_AXIS] = (endy - starty) / (GRID_MAX_POINTS_Y - 1);
    bilinear_start[X_AXIS] = startx;
    bilinear_start[Y_AXIS] = starty;
    let bilinear_grid_spacing_virt = []
    bilinear_grid_spacing_virt[X_AXIS] = bilinear_grid_spacing[X_AXIS] / (BILINEAR_SUBDIVISIONS);
    bilinear_grid_spacing_virt[Y_AXIS] = bilinear_grid_spacing[Y_AXIS] / (BILINEAR_SUBDIVISIONS);
    let bilinear_grid_factor_virt = []
    bilinear_grid_factor_virt[X_AXIS] = RECIPROCAL(bilinear_grid_spacing_virt[X_AXIS]);
    bilinear_grid_factor_virt[Y_AXIS] = RECIPROCAL(bilinear_grid_spacing_virt[Y_AXIS]);

    const ABL_BG_GRID = (X,Y) => z_values_virt[X][Y]
   const ABL_BG_FACTOR = (A) => bilinear_grid_factor_virt[A]

  let z1, d2, z3, d4, L, D, ratio_x, ratio_y,
               last_x = -999.999, last_y = -999.999;

  // Whole units for the grid line indices. Constrained within bounds.
  let gridx, gridy, nextx, nexty,
                last_gridx = -99, last_gridy = -99;

  // XY relative to the probed area
  const  rx = raw[X_AXIS] - bilinear_start[X_AXIS],
              ry = raw[Y_AXIS] - bilinear_start[Y_AXIS];

//   #if ENABLED(EXTRAPOLATE_BEYOND_GRID)
//     // Keep using the last grid box
//     #define FAR_EDGE_OR_BOX 2
//   #else
//     // Just use the grid far edge
//     #define FAR_EDGE_OR_BOX 1
//   #endif
  let FAR_EDGE_OR_BOX  = 2
  
  if (last_x != rx) {
    last_x = rx;
    ratio_x = rx * ABL_BG_FACTOR(X_AXIS);
    const  gx = constrain(FLOOR(ratio_x), 0, ABL_BG_POINTS_X - (FAR_EDGE_OR_BOX));
    ratio_x -= gx;      // Subtract whole to get the ratio within the grid box

    // #if DISABLED(EXTRAPOLATE_BEYOND_GRID)
    //   // Beyond the grid maintain height at grid edges
    //   NOLESS(ratio_x, 0); // Never < 0.0. (> 1.0 is ok when nextx==gridx.)
    // #endif

    gridx = gx;
    nextx = Math.min(gridx + 1, ABL_BG_POINTS_X - 1);
  }

  if (last_y != ry || last_gridx != gridx) {

    if (last_y != ry) {
      last_y = ry;
      ratio_y = ry * ABL_BG_FACTOR(Y_AXIS);
      const gy = constrain(FLOOR(ratio_y), 0, ABL_BG_POINTS_Y - (FAR_EDGE_OR_BOX));
      ratio_y -= gy;

    //   #if DISABLED(EXTRAPOLATE_BEYOND_GRID)
    //     // Beyond the grid maintain height at grid edges
    //     NOLESS(ratio_y, 0); // Never < 0.0. (> 1.0 is ok when nexty==gridy.)
    //   #endif

      gridy = gy;
      nexty = Math.min(gridy + 1, ABL_BG_POINTS_Y - 1);
    }
    // console.log('point located:', gridx,gridy)
    // console.log( 'x positions:',
    //     z_values_virt[gridx][gridy]
    //     ,z_values_virt[nextx][gridy])
    // console.log( 'y positions:',
    //     z_values_virt[gridx][nexty]
    //     ,z_values_virt[nextx][nexty]
    //     )
    if (last_gridx != gridx || last_gridy != gridy) {
      last_gridx = gridx;
      last_gridy = gridy;
      // Z at the box corners
    
      z1 = ABL_BG_GRID(gridx, gridy);       // left-front
      d2 = ABL_BG_GRID(gridx, nexty) - z1;  // left-back (delta)
      z3 = ABL_BG_GRID(nextx, gridy);       // right-front
      d4 = ABL_BG_GRID(nextx, nexty) - z3;  // right-back (delta)
      
    }

    // Bilinear interpolate. Needed since ry or gridx has changed.
                L = z1 + d2 * ratio_y;   // Linear interp. LF -> LB
    const  R = z3 + d4 * ratio_y;   // Linear interp. RF -> RB

    D = R - L;
  }

  const  offset = L + ratio_x * D;   // the offset almost always changes
  

  return offset;
}

  export default bilinear_z_offset
  
  

 

// console.log()