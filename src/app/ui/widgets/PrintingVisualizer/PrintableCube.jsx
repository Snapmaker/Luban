import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    FrontSide,
    Group,
    Line,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshPhongMaterial,
    Object3D,
    PlaneGeometry,
    Shape,
    ShapeGeometry
} from 'three';
import { DEFAULT_LUBAN_HOST } from '../../../constants';
import { findMachineByName } from '../../../constants/machines';
import log from '../../../lib/log';
import { FontLoader } from '../../../scene/three-extensions/FontLoader';
import STLLoader from '../../../scene/three-extensions/STLLoader';
import SVGLoader from '../../../scene/three-extensions/SVGLoader';
import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';
import Rectangle from '../../../scene/objects/Rectangle';
import { SnapmakerArtisanMachine } from '../../../machines';
// import i18n from '../../../lib/i18n';

class PrintableCube extends Object3D {
    size = { x: 0, y: 0 };

    stopArea = {
        left: 20,
        right: 20,
        front: 20,
        back: 20,
    };

    stopAreaObjects = [];

    scale10line;
    scale50line;
    scale10lineVisible = false;
    scale50lineVisible = true;
    hotArea;
    series;

    constructor(series, size, stopArea) {
        super();
        this.type = 'PrintCube';
        this.series = series;
        this.size = size;
        this.stopArea = stopArea;
        this.stopAreaObjects = [];
        /**
         * mesh renderOrder
         * - background 1   0
         * - stopArea   2   0.001
         * - line       3   0.002
         * - logo       4
         */
        this._setup();
        this._setupStopArea();
    }

    getSize() {
        return this.size;
    }

    getStopArea() {
        return this.stopArea;
    }

    updateSize(series, size, stopArea) {
        log.info('DEBUG:cube.updateSize', size, stopArea);

        this.series = series;
        this.size = size;

        ThreeUtils.dispose(this);
        this.remove(...this.children);
        this._setup();

        this.updateStopArea(stopArea);
    }

    updateStopArea(stopArea) {
        this.stopAreaObjects.forEach((mesh) => {
            this.remove(mesh);
        });
        this.stopAreaObjects = [];

        this.stopArea.left = stopArea.left ?? this.stopArea.left;
        this.stopArea.right = stopArea.right ?? this.stopArea.right;
        this.stopArea.back = stopArea.back ?? this.stopArea.back;
        this.stopArea.front = stopArea.front ?? this.stopArea.front;
        this._setupStopArea();
        this.update();
    }

    update = () => {
        this.dispatchEvent({ type: 'update' });
    };

    _setupStopArea() {
        const { left, right, front, back } = this.stopArea;
        const { x, y } = this.size;

        const material = new MeshBasicMaterial({
            color: '#DCDDDF',
            side: FrontSide,
            opacity: 0.7,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: 0,
            polygonOffsetUnits: 3,

        });
        // front
        const geometry1 = new PlaneGeometry(x, Math.max(front, 0.01));
        const mesh1 = new Mesh(geometry1, material);
        mesh1.name = 'Stop Area - Front';
        mesh1.position.set(0, -y / 2 + front / 2, 0);
        this.add(mesh1);
        mesh1.renderOrder = -4;
        this.stopAreaObjects.push(mesh1);

        // back
        const geometry2 = new PlaneGeometry(x, Math.max(back, 0.01));
        const mesh2 = new Mesh(geometry2, material);
        mesh2.name = 'Stop Area - Back';
        mesh2.position.set(0, y / 2 - back / 2, 0);
        this.add(mesh2);
        mesh2.renderOrder = -4;
        this.stopAreaObjects.push(mesh2);

        // left
        const geometry3 = new PlaneGeometry(Math.max(left, 0.01), Math.max(y - back - front, 0.01));
        const mesh3 = new Mesh(geometry3, material);
        mesh3.name = 'Stop Area - Left';
        mesh3.position.set(-x / 2 + left / 2, (front - back) / 2, 0);
        this.add(mesh3);
        mesh3.renderOrder = -4;
        this.stopAreaObjects.push(mesh3);

        // right
        const geometry4 = new PlaneGeometry(Math.max(right, 0.01), Math.max(y - back - front, 0.01));
        const mesh4 = new Mesh(geometry4, material);
        mesh4.name = 'Stop Area - Right';
        mesh4.position.set(x / 2 - right / 2, (front - back) / 2, 0);
        this.add(mesh4);
        mesh4.renderOrder = -4;
        this.stopAreaObjects.push(mesh4);
    }

    _setup() {
        const scale50Vertices = [];
        const scale10Vertices = [];
        let counter = 5;

        for (let x = 0; x < this.size.x / 2; x += 10) {
            if (counter === 5) {
                counter = 1;
                scale50Vertices.push(x, -this.size.y / 2, 0, x, this.size.y / 2, 0);
            } else {
                counter++;
                scale10Vertices.push(x, -this.size.y / 2, 0, x, this.size.y / 2, 0);
            }
        }
        counter = 0;
        for (let x = 0; x > -this.size.x / 2; x -= 10) {
            if (counter === 5) {
                counter = 1;
                scale50Vertices.push(x, -this.size.y / 2, 0, x, this.size.y / 2, 0);
            } else {
                counter++;
                scale10Vertices.push(x, -this.size.y / 2, 0, x, this.size.y / 2, 0);
            }
        }
        counter = 5;

        for (let y = 0; y < this.size.y / 2; y += 10) {
            if (counter === 5) {
                counter = 1;
                scale50Vertices.push(-this.size.x / 2, y, 0, this.size.x / 2, y, 0);
            } else {
                counter++;
                scale10Vertices.push(-this.size.x / 2, y, 0, this.size.x / 2, y, 0);
            }
        }
        counter = 0;
        for (let y = 0; y > -this.size.y / 2; y -= 10) {
            if (counter === 5) {
                counter = 1;
                scale50Vertices.push(-this.size.x / 2, y, 0, this.size.x / 2, y, 0);
            } else {
                counter++;
                scale10Vertices.push(-this.size.x / 2, y, 0, this.size.x / 2, y, 0);
            }
        }

        const scale50Geometry = new BufferGeometry();
        scale50Geometry.setAttribute('position', new Float32BufferAttribute(scale50Vertices, 3));
        const scale10Geometry = new BufferGeometry();
        scale10Geometry.setAttribute('position', new Float32BufferAttribute(scale10Vertices, 3));
        const scaleLineMaterial = new LineBasicMaterial({
            side: FrontSide,
            color: '#E8EAED',
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: 0,
            polygonOffsetUnits: 4,
        });
        const scale50line = new LineSegments(scale50Geometry, scaleLineMaterial);
        const scale10line = new LineSegments(scale10Geometry, scaleLineMaterial);
        scale50line.renderOrder = -6;
        this.scale50line = scale50line;
        this.add(scale50line);
        scale10line.renderOrder = -6;
        this.scale10line = scale10line;
        scale10line.visible = false;
        this.add(scale10line);

        const top = Rectangle.createRectangle(this.size.x, this.size.y, '#D5D6D9');
        top.position.set(0, 0, this.size.z);
        this.add(top);

        const bottomBorder = top.clone();
        bottomBorder.position.set(0, 0, 0);
        this.add(bottomBorder);

        const left = Rectangle.createRectangle(this.size.z, this.size.y, '#D5D6D9');
        left.rotateY(-Math.PI / 2);
        left.position.set(-this.size.x / 2, 0, this.size.z / 2);
        this.add(left);

        const right = left.clone();
        right.position.set(this.size.x / 2, 0, this.size.z / 2);
        this.add(right);

        // Add background
        const backgroundGeometry = new PlaneGeometry(this.size.x, this.size.y);
        const backgroundMaterial = new MeshBasicMaterial({
            color: '#fff',
            side: FrontSide,
            polygonOffset: true,
            polygonOffsetFactor: 0,
            polygonOffsetUnits: 5,
        });
        const background = new Mesh(backgroundGeometry, backgroundMaterial);
        background.position.set(0, 0, 0);
        background.renderOrder = -5;
        this.add(background);

        this.createSeries();

        if (this.series === SnapmakerArtisanMachine.identifier) {
            const hotArea = this.roundedRectShape(-130, -130, 260, 260, 10);
            const geometry = new ShapeGeometry(hotArea);
            const mesh = new Line(geometry, new LineBasicMaterial({
                color: '#D5D6D9',
                side: FrontSide,
                opacity: 1,
                transparent: true,
                polygonOffset: true,
                polygonOffsetFactor: 0,
                polygonOffsetUnits: -20
            }));
            mesh.renderOrder = -1;
            this.hotArea = mesh;
            this.add(mesh);
        }

        // this.loadBaseplate();
        // this.loadBackground();
    }

    createSeries() {
        const loader = new FontLoader();
        loader.load(`${DEFAULT_LUBAN_HOST}/resources/print-board/helvetiker_regular.typeface.json`, (font) => {
            const color = new Color('#B9BCBF');
            const matLite = new MeshBasicMaterial({
                color: color,
                transparent: true,
                side: FrontSide,
                depthWrite: false,
                wireframe: false,
                polygonOffset: true,
                polygonOffsetFactor: 0,
                polygonOffsetUnits: 2
            });

            const fontSize = this.size.y * 0.025;

            const machine = findMachineByName(this.series);
            const machineText = machine.fullName;
            // machineText = machineText.replace(/^Snapmaker\s*(2\.0)?\s*/, '');

            const shapes = font.generateShapes(machineText, fontSize);
            const geometry = new ShapeGeometry(shapes);
            geometry.computeBoundingBox();
            const fontWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
            const fontHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

            geometry.translate(
                this.size.x / 2 - fontWidth - (this.size.x / 2 % 10 || 10) - 10,
                -this.size.y / 2 + (this.size.y / 2 % 10 || 10) + 10,
                0.005
            );
            const text = new Mesh(geometry, matLite);
            this.add(text);

            // Add logo
            new SVGLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/logo.svg`, (data) => {
                const paths = data.paths;

                const group = new Group();

                group.position.x = 0;
                group.position.y = 0;
                group.scale.y *= -1;
                for (let i = 0; i < paths.length; i++) {
                    const path = paths[i];

                    const fillColor = path.userData.style.fill;
                    if (fillColor !== undefined && fillColor !== 'none') {
                        const material = new MeshBasicMaterial({
                            color: fillColor,
                            opacity: path.userData.style.fillOpacity,
                            transparent: true,
                            side: FrontSide,
                            depthWrite: false,
                            wireframe: false,
                            polygonOffset: true,
                            polygonOffsetFactor: 0,
                            polygonOffsetUnits: 2
                        });

                        const pathShape = SVGLoader.createShapes(path);

                        for (let j = 0; j < pathShape.length; j++) {
                            const shape = pathShape[j];

                            const fontGeometry = new ShapeGeometry(shape);
                            const mesh = new Mesh(fontGeometry, material);

                            group.add(mesh);
                        }
                    }
                }

                const logoBoundingBox = ThreeUtils.computeBoundingBox(group);
                const logoHeight = logoBoundingBox.max.y - logoBoundingBox.min.y;
                group.scale.setX(fontHeight / logoHeight);
                group.scale.setY(-fontHeight / logoHeight);

                const newLogoBoundingBox = ThreeUtils.computeBoundingBox(group);
                group.position.set(
                    this.size.x / 2 - newLogoBoundingBox.max.x - (this.size.x / 2 % 10 || 10) - 10,
                    geometry.boundingBox.max.y + geometry.boundingBox.max.y - geometry.boundingBox.min.y + fontHeight * 0.4,
                    0.01
                );
                this.add(group);
            });
        });
    }

    roundedRectShape(x, y, width, height, radius) {
        const shape = new Shape();
        shape.moveTo(x, y + radius + 10);
        shape.lineTo(x, y + height - radius);
        radius && shape.absarc(x + radius, y + height - radius, radius, Math.PI, 90 / 180 * Math.PI, true);
        shape.lineTo(x + width - radius, y + height);
        radius && shape.absarc(x + width - radius, y + height - radius, radius, 90 / 180 * Math.PI, 0, true);
        shape.lineTo(x + width, y + radius);
        radius && shape.absarc(x + width - radius, y + radius, radius, 0, 270 / 180 * Math.PI, true);
        shape.lineTo(x + radius, y);
        radius && shape.absarc(x + radius, y + radius, radius, 270 / 180 * Math.PI, Math.PI, true);
        shape.lineTo(x, y + radius + 15);
        return shape;
    }

    // Check if point is in hot area
    isPointInShape(point) {
        // only Artisan contains hot area
        if (this.series !== SnapmakerArtisanMachine.identifier) {
            return true;
        }

        const res = this.pointInsideRect(point, -130, -130, 260, 260);
        if (!res) {
            return false;
        }
        if (point.x > -130 && point.x < -120) {
            if (point.y > 120 && point.y < 130) {
                return this.pointInsideCircle(point, -120, 120, 10);
            } else if (point.y > -130 && point.y < -120) {
                return this.pointInsideCircle(point, -120, -120, 10);
            }
        } else if (point.x > 120 && point.x < 130) {
            if (point.y > 120 && point.y < 130) {
                return this.pointInsideCircle(point, 120, 120, 10);
            } else if (point.y > -130 && point.y < -120) {
                return this.pointInsideCircle(point, 120, -120, 10);
            }
        }
        return true;
    }

    pointInsideCircle(point, x, y, radius) {
        return Math.sqrt(Math.abs(point.x - x) ** 2 + Math.abs(point.y - y) ** 2) - radius < 0;
    }

    pointInsideRect(point, x, y, width, height) {
        if (point.x < x || point.x > x + width) {
            return false;
        }
        if (point.y < y || point.y > y + height) {
            return false;
        }
        return true;
    }

    loadBaseplate() {
        new STLLoader().load(
            `${DEFAULT_LUBAN_HOST}/resources/print-board/a400.stl`,
            (geometry) => {
                geometry.computeBoundingBox();
                // const box3 = geometry.boundingBox;
                // const x = -(box3.max.x + box3.min.x) / 2;
                // const y = -(box3.max.y + box3.min.y) / 2;
                // const z = -(box3.max.z + box3.min.z) / 2;
                geometry.translate(-200, 350, -30);
                // geometry.scale(1, -1, 1);
                const material = new MeshPhongMaterial({
                    side: FrontSide,
                    color: '#2a2c2e',
                    specular: 0xb0b0b0,
                    shininess: 0,
                    transparent: true,
                    opacity: 0.3,
                    polygonOffset: true,
                    polygonOffsetFactor: 0,
                    polygonOffsetUnits: 6
                });
                const mesh = new Mesh(geometry, material);
                this.add(mesh);
            },
            () => { },
            () => { }
        );
    }

    loadBackground() {
        new STLLoader().load(
            `${DEFAULT_LUBAN_HOST}/resources/print-board/background.stl`,
            (geometry) => {
                geometry.computeBoundingBox();
                const box3 = geometry.boundingBox;
                const x = (box3.max.x - box3.min.x);
                const y = (box3.max.y - box3.min.y);
                geometry.translate(-200, 350, -30);
                geometry.scale(410 / x, 410 / y, 1);
                const material = new MeshPhongMaterial({
                    side: FrontSide,
                    color: '#2a2c2e',
                    specular: 0xb0b0b0,
                    shininess: 0,
                    transparent: true,
                    opacity: 0.3,
                    polygonOffset: true,
                    polygonOffsetFactor: 0,
                    polygonOffsetUnits: 6
                });
                const mesh = new Mesh(geometry, material);

                this.add(mesh);
            },
            () => { },
            () => { }
        );
    }

    setScale50lineVisible(visible) {
        let needRefresh = false;
        if (visible) {
            if (!this.scale50lineVisible) {
                this.scale50line.visible = true;
                this.scale50lineVisible = true;
                needRefresh = true;
            }
        } else {
            if (this.scale50lineVisible) {
                this.scale50line.visible = false;
                this.scale50lineVisible = false;
                needRefresh = true;
            }
        }
        return needRefresh;
    }

    setScale10lineVisible(visible) {
        let needRefresh = false;
        if (visible) {
            if (!this.scale10lineVisible) {
                this.scale10line.visible = true;
                this.scale10lineVisible = true;
                needRefresh = true;
            }
        } else {
            if (this.scale10lineVisible) {
                this.scale10line.visible = false;
                this.scale10lineVisible = false;
                needRefresh = true;
            }
        }
        return needRefresh;
    }

    toogleVisible() {
        let needRefresh = false;

        if (this.cameraPositionZ < 0) {
            needRefresh = this.setScale50lineVisible(false);
            needRefresh = this.setScale10lineVisible(false);
        } else {
            if (this.panScale > 2) {
                needRefresh = this.setScale10lineVisible(true);
            } else {
                needRefresh = this.setScale10lineVisible(false);
            }
            needRefresh = this.setScale50lineVisible(true);
        }
        return needRefresh;
    }

    onPanScale(scale) {
        this.panScale = scale;
        return this.toogleVisible();
    }

    updateCamera(position) {
        this.cameraPositionZ = position.z;
        return this.toogleVisible();
    }
}

export default PrintableCube;
