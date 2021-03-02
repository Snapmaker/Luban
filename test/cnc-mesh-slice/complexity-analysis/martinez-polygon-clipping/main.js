// import * as martinez from 'martinez-polygon-clipping';
//
// const generatePolygon = (n, max = 10000) => {
//     const polygon = [];
//     for (let i = 0; i < n; i++) {
//         const x = Math.random() * max;
//         const y = Math.random() * max;
//         polygon.push([x, y]);
//     }
//     polygon.push(polygon[0]);
//
//     return polygon;
// };
//
// const polygons1 = [];
// const polygons2 = [];
//
// for (let i = 0; i < 1000; i++) {
//     polygons1.push(generatePolygon(1000));
//     polygons2.push(generatePolygon(10));
// }
//
// // eslint-disable-next-line no-unused-vars
// const ns = [1, 10, 100, 1000];
// // eslint-disable-next-line no-unused-vars
// const ms = [1, 10, 100, 1000];
//
// const ds = [];
//
// const tTest = (i, j, n, m) => {
//     let ad = 0;
//     for (let k = 0; k < 1; k++) {
//         const p1 = generatePolygon(n);
//         const p2 = generatePolygon(m);
//         const d = new Date();
//         // eslint-disable-next-line no-unused-vars
//         const result = martinez.union(p1, p2);
//         ad += new Date().getTime() - d.getTime();
//     }
//     if (!ds[i]) {
//         ds[i] = [];
//     }
//     console.log(n, m, ad / 1);
//     ds[i][j] = ad / 5;
// };
//
// console.log(new Date().getTime());
//
// // for (let i = 0; i < 4; i++) {
// //     for (let j = 0; j < 4; j++) {
// //         tTest(i, j, ns[i], ms[j]);
// //     }
// // }
//
// tTest(1, 1, 1000, 2000);
//
//
// console.log(ds);
