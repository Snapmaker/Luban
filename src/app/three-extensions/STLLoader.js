/* eslint-disable */

import * as THREE from "three";

/**
 * @author aleeper / http://adamleeper.com/
 * @author mrdoob / http://mrdoob.com/
 * @author gero3 / https://github.com/gero3
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Description: A THREE loader for STL ASCII files, as created by Solidworks and other CAD programs.
 *
 * Supports both binary and ASCII encoded files, with automatic detection of type.
 *
 * The loader returns a non-indexed buffer geometry.
 *
 * Limitations:
 *  Binary decoding supports "Magics" color format (http://en.wikipedia.org/wiki/STL_(file_format)#Color_in_binary_STL).
 *  There is perhaps some question as to how valid it is to always assume little-endian-ness.
 *  ASCII decoding assumes file is UTF-8.
 *
 * Usage:
 *  var loader = new THREE.STLLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: THREE.VertexColors });
 *  } else { .... }
 *  var mesh = new THREE.Mesh( geometry, material );
 */


const STLLoader = function ( manager ) {
	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
};
const rotateZMatrix = new THREE.Matrix4();

STLLoader.prototype = {

	constructor: STLLoader,

	load: function ( url, onLoad, onProgress, onError ) {
		var scope = this;
		var loader = new THREE.FileLoader( scope.manager );
		loader.setResponseType( 'arraybuffer' );
		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text, onProgress ) );

			} catch ( exception ) {

				if ( onError ) {

					onError( exception );

				}

			}

		}, null, onError );

	},

	parse: function ( data, onProgress ) {
		function isBinary( data ) {

			var expect, face_size, n_faces, reader;
			reader = new DataView( data );
			face_size = ( 32 / 8 * 3 ) + ( ( 32 / 8 * 3 ) * 3 ) + ( 16 / 8 );
			n_faces = reader.getUint32( 80, true );
			expect = 80 + ( 32 / 8 ) + ( n_faces * face_size );

			if ( expect === reader.byteLength ) {

				return true;

			}

			// An ASCII STL data must begin with 'solid ' as the first six bytes.
			// However, ASCII STLs lacking the SPACE after the 'd' are known to be
			// plentiful.  So, check the first 5 bytes for 'solid'.

			// US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'

			var solid = [ 115, 111, 108, 105, 100 ];

			for ( var i = 0; i < 5; i ++ ) {

				// If solid[ i ] does not match the i-th byte, then it is not an
				// ASCII STL; hence, it is binary and return true.

				if ( solid[ i ] != reader.getUint8( i, false ) ) return true;

 			}

			// First 5 bytes read "solid"; declare it to be an ASCII STL

			return false;

		}

        // TODO: loading file over 480M will crash because of memory limit
		function parseBinary( data, onProgress ) {
			var reader = new DataView( data );
			var faces = reader.getUint32( 80, true );

			var r, g, b, hasColors = false, colors;
			var defaultR, defaultG, defaultB, alpha;

			// process STL header
			// check for default color in header ("COLOR=rgba" sequence).

			for ( var index = 0; index < 80 - 10; index ++ ) {

				if ( ( reader.getUint32( index, false ) == 0x434F4C4F /*COLO*/ ) &&
					( reader.getUint8( index + 4 ) == 0x52 /*'R'*/ ) &&
					( reader.getUint8( index + 5 ) == 0x3D /*'='*/ ) ) {

					hasColors = true;
					colors = [];

					defaultR = reader.getUint8( index + 6 ) / 255;
					defaultG = reader.getUint8( index + 7 ) / 255;
					defaultB = reader.getUint8( index + 8 ) / 255;
					alpha = reader.getUint8( index + 9 ) / 255;

				}

			}

			var dataOffset = 84;
			var faceLength = 12 * 4 + 2;

			var geometry = new THREE.BufferGeometry();

			var vertices = [];
			var normals = [];
			var faceVertexUvs = [[]];
			var uv = [];
			console.log('faces', faces);

			for ( var face = 0; face < faces; face ++ ) {
			    if (face / faces - progress > 0.01) {
                    progress = face / faces;
                    onProgress(progress);
                }

				var start = dataOffset + face * faceLength;
				var normalX = reader.getFloat32( start, true );
				var normalY = reader.getFloat32( start + 4, true );
				var normalZ = reader.getFloat32( start + 8, true );
				var maxX = Number.MIN_SAFE_INTEGER, minX = Number.MAX_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER;
				var currentVertices = [];
				var currentUv = [];

				if ( hasColors ) {

					var packedColor = reader.getUint16( start + 48, true );

					if ( ( packedColor & 0x8000 ) === 0 ) {

						// facet has its own unique color

						r = ( packedColor & 0x1F ) / 31;
						g = ( ( packedColor >> 5 ) & 0x1F ) / 31;
						b = ( ( packedColor >> 10 ) & 0x1F ) / 31;

					} else {

						r = defaultR;
						g = defaultG;
						b = defaultB;

					}

				}

				for ( var i = 1; i <= 3; i ++ ) {

					var vertexstart = start + i * 12;
					var vertice1 = reader.getFloat32( vertexstart, true );
					var vertice2 = reader.getFloat32( vertexstart+ 4, true );
					var vertice3 = reader.getFloat32( vertexstart+ 8, true );

					vertices.push( vertice1 );
					vertices.push( vertice2 );
					vertices.push( vertice3 );
					let currentVertice = new THREE.Vector3(vertice1, vertice2, vertice3);
					// console.log('vertice1, vertice2, vertice3', vertice1, vertice2, vertice3);
					const xyVecrtice = new THREE.Vector3(vertice1, vertice2, 0);
					// console.log('xyVecrtice', currentVertice, xyVecrtice);
					const angle = currentVertice.angleTo(xyVecrtice);
					let currentXyVertice = currentVertice;

					// if (angle > 5*Math.PI/180 && angle < 175*Math.PI/180 ) {
						rotateZMatrix.set(
							Math.cos(angle), -Math.sin(angle), 0, 0,
							Math.sin(angle),  Math.cos(angle), 0, 0,
							0,       0,      1,  0,
							0,       0,      0,  1
						);
						currentXyVertice = currentVertice.applyMatrix4(rotateZMatrix);
					// }

					minX = Math.min(currentXyVertice.x, minX);
					minY = Math.min(currentXyVertice.y, minY);
					maxX = Math.max(currentXyVertice.x, maxX);
					maxY = Math.max(currentXyVertice.y, maxY);

					// if (vertice1 === 109.88607025146484 && vertice2 === -81.95313262939453) {
						console.log('currentXyVertice',new THREE.Vector3(vertice1, vertice2, vertice3), currentXyVertice, angle);
					// }
					currentVertices.push(currentXyVertice)

					normals.push( normalX, normalY, normalZ );

					if ( hasColors ) {

						colors.push( r, g, b );

					}

				}
					let maxLength = Math.max(maxX-minX, maxY - minY);
					// console.log('maxX',  maxLength, currentVertices);
					currentUv = currentVertices.map((item, index) => {
						let newX, newY;
						newX = (item.x - minX)/maxLength;
						newY = (item.y - minY)/maxLength;
						console.log('newX, newY',index, newX, newY);
						return new THREE.Vector2(newX,newY)
					});
					// console.log('currentUv', currentUv);
				faceVertexUvs[0].push(currentUv);
				// faceVertexUvs[0].push([new THREE.Vector2(0,1), new THREE.Vector2(1,1), new THREE.Vector2(0,0)]);

			}

			geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
			geometry.setAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normals ), 3 ) );
		    // https://stackoverflow.com/questions/55472178/how-to-add-texture-to-buffergeometry-faces
			faceVertexUvs[0].forEach( function ( faceUvs ) {
	          for (let i = 0; i < 3; ++i) {
	              uv.push( ...faceUvs[i].toArray() );
	          }
	        });
			geometry.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uv ), 2 ));

			if ( hasColors ) {

				geometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array( colors ), 3 ) );
				geometry.hasColors = true;
				geometry.alpha = alpha;

			}

			return geometry;

		}

		function parseASCII( data, onProgress ) {
			var geometry = new THREE.BufferGeometry();
			var patternFace = /facet([\s\S]*?)endfacet/g;
			var faceCounter = 0;

            /**
             * ascii stl format is following
             * so face count is (line count) / 7
             solid exported
                 facet normal 1 0 0
                     outer loop
                         vertex 7.500000476837158 3 9
                         vertex 7.500000476837158 -3 9
                         vertex 7.500000476837158 3 0
                     endloop
                 endfacet
                 ...
             endsolid exported
             */
			var faceCountExpected = data.toString().split('\n').length / 7;

			var patternFloat = /[\s]+([+-]?(?:\d+.\d+|\d+.|\d+|.\d+)(?:[eE][+-]?\d+)?)/.source;
			var patternVertex = new RegExp( 'vertex' + patternFloat + patternFloat + patternFloat, 'g' );
			var patternNormal = new RegExp( 'normal' + patternFloat + patternFloat + patternFloat, 'g' );

			var vertices = [];
			var normals = [];

			var normal = new THREE.Vector3();

			var result;

			while ( ( result = patternFace.exec( data ) ) !== null ) {

				var vertexCountPerFace = 0;
				var normalCountPerFace = 0;

				var text = result[ 0 ];

				while ( ( result = patternNormal.exec( text ) ) !== null ) {

					normal.x = parseFloat( result[ 1 ] );
					normal.y = parseFloat( result[ 2 ] );
					normal.z = parseFloat( result[ 3 ] );
					normalCountPerFace ++;

				}

				while ( ( result = patternVertex.exec( text ) ) !== null ) {

					vertices.push( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );
					normals.push( normal.x, normal.y, normal.z );
					vertexCountPerFace ++;

				}

				// every face have to own ONE valid normal

				if ( normalCountPerFace !== 1 ) {

					console.error( 'THREE.STLLoader: Something isn\'t right with the normal of face number ' + faceCounter );

				}

				// each face have to own THREE valid vertices

				if ( vertexCountPerFace !== 3 ) {

					console.error( 'THREE.STLLoader: Something isn\'t right with the vertices of face number ' + faceCounter );

				}

				faceCounter ++;

                if (faceCounter / faceCountExpected - progress > 0.01) {
                    progress = faceCounter / faceCountExpected;
                    onProgress(progress);
                }
			}

			geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
			geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );

			return geometry;

		}

		function ensureString( buffer ) {

			if ( typeof buffer !== 'string' ) {

				return THREE.LoaderUtils.decodeText( new Uint8Array( buffer ) );

			}

			return buffer;

		}

		function ensureBinary( buffer ) {

			if ( typeof buffer === 'string' ) {

				var array_buffer = new Uint8Array( buffer.length );
				for ( var i = 0; i < buffer.length; i ++ ) {

					array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

				}
				return array_buffer.buffer || array_buffer;

			} else {

				return buffer;

			}

		}

		// start

		var binData = ensureBinary( data );
        var progress = 0;

		return isBinary( binData ) ? parseBinary( binData, onProgress ) : parseASCII( ensureString( data ), onProgress );

	}

};

export default STLLoader;
