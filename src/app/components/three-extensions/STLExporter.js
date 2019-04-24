/* eslint-disable */
/**
 * @author kovacsv / http://kovacsv.hu/
 * @author mrdoob / http://mrdoob.com/
 *
 * modified by Walker
 * 1. Use local matrix rather than world matrix (line 31)
 * 2. Switch y and z (line 65) to handle left-hand and right-hand coordinate problem
 */

import * as THREE from 'three';

THREE.STLExporter = function () {};

THREE.STLExporter.prototype = {

	constructor: THREE.STLExporter,

	parse: ( function () {

		var vector = new THREE.Vector3();
		var normalMatrixLocal = new THREE.Matrix3();

		return function parse( scene ) {

			var output = '';

			output += 'solid exported\n';

			scene.traverse( function ( object ) {

				if ( object instanceof THREE.Mesh ) {

					var geometry = object.geometry;
					var matrixLocal = object.matrix;

					if ( geometry instanceof THREE.BufferGeometry ) {

						geometry = new THREE.Geometry().fromBufferGeometry( geometry );

					}

					if ( geometry instanceof THREE.Geometry ) {

						var vertices = geometry.vertices;
						var faces = geometry.faces;

						normalMatrixLocal.getNormalMatrix( matrixLocal );

						for ( var i = 0, l = faces.length; i < l; i ++ ) {

							var face = faces[ i ];

							vector.copy( face.normal ).applyMatrix3( normalMatrixLocal ).normalize();

							output += '\tfacet normal ' + vector.x + ' ' + vector.y + ' ' + vector.z + '\n';
							output += '\t\touter loop\n';

							var indices = [ face.a, face.b, face.c ];

							for ( var j = 0; j < 3; j ++ ) {

								vector.copy( vertices[ indices[ j ] ] ).applyMatrix4( matrixLocal );

                                // output += '\t\t\tvertex ' + vector.x + ' ' + vector.y + ' ' + vector.z + '\n';
								output += '\t\t\tvertex ' + vector.x + ' ' + (-vector.z) + ' ' + vector.y + '\n';

							}

							output += '\t\tendloop\n';
							output += '\tendfacet\n';

						}

					}

				}

			} );

			output += 'endsolid exported\n';

			return output;

		};

	}() )

};

export default THREE.STLExporter;