import {
    Box3,
    Mesh,
    PerspectiveCamera,
    Color,
    Scene,
    Vector3,
    WebGLRenderer,
    AmbientLight,
    SpotLight,
    MeshPhongMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GCodeParser } from './parser';
import { SegmentColorizer } from './SegmentColorizer';

/**
 * GCode renderer which parses a GCode file and displays it using
 * three.js. Use .element() to retrieve the DOM canvas element.
 */
export class GCodeRenderer {
    private readonly scene: Scene

    private readonly renderer: WebGLRenderer

    private cameraControl?: OrbitControls

    private camera: PerspectiveCamera

    private lineMaterial = new MeshPhongMaterial({ vertexColors: true })

    private readonly parser: GCodeParser

    // Public configurations:

    /**
     * Width of travel-lines. Use 0 to hide them.
     *
     * @type number
     */
    public get travelWidth(): number {
        return this.parser.travelWidth;
    }

    /**
     * Width of travel-lines. Use 0 to hide them.
     *
     * @type number
     */
    public set travelWidth(w: number) {
        this.parser.travelWidth = w;
    }

    /**
     * Set any colorizer implementation to change the segment color based on the segment
     * metadata. Some default implementations are provided.
     *
     * @type SegmentColorizer
     */
    public get colorizer(): SegmentColorizer {
        return this.parser.colorizer;
    }

    /**
     * Set any colorizer implementation to change the segment color based on the segment
     * metadata. Some default implementations are provided.
     *
     * @type SegmentColorizer
     */
    public set colorizer(colorizer: SegmentColorizer) {
        this.parser.colorizer = colorizer;
    }

    /**
     * The number of radial segments per line.
     * Less (e.g. 3) provides faster rendering with less memory usage.
     * More (e.g. 8) provides a better look.
     *
     * @default 8
     * @type number
     */
    public get radialSegments(): number {
        return this.parser.radialSegments;
    }

    /**
     * The number of radial segments per line.
     * Less (e.g. 3) provides faster rendering with less memory usage.
     * More (e.g. 8) provides a better look.
     *
     * @default 8
     * @type number
     */
    public set radialSegments(segments: number) {
        this.parser.radialSegments = segments;
    }

    /**
     * Internally the rendered object is split into several. This allows to reduce the
     * memory consumption while rendering.
     * You can set the number of points per object.
     * In most cases you can leave this at the default.
     *
     * @default 120000
     * @type number
     */
    public get pointsPerObject(): number {
        return this.parser.pointsPerObject;
    }

    /**
     * Internally the rendered object is split into several. This allows to reduce the
     * memory consumption while rendering.
     * You can set the number of points per object.
     * In most cases you can leave this at the default.
     *
     * @default 120000
     * @type number
     */
    public set pointsPerObject(num: number) {
        this.parser.pointsPerObject = num;
    }

    /**
     * Creates a new GCode renderer for the given gcode.
     * It initializes the canvas to the given size and
     * uses the passed color as background.
     *
     * @param {string} gCode
     * @param {number} width
     * @param {number} height
     * @param {Color} background
     */
    constructor(gCode: string, width: number, height: number, background: Color) {
        this.scene = new Scene();
        this.renderer = new WebGLRenderer();
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(background, 1);
        this.camera = this.newCamera(width, height);

        this.parser = new GCodeParser(gCode);
    }

    /**
     * This can be used to retrieve some min / max values which may
     * be needed as param for a colorizer.
     * @returns {{
     *         minTemp: number | undefined,
     *         maxTemp: number,
     *         minSpeed: number | undefined,
     *         maxSpeed: number
     *     }}
     */
    public getMinMaxValues() {
        return this.parser.getMinMaxValues();
    }

    private newCamera(width: number, height: number) {
        const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

        if (this.cameraControl) {
            this.cameraControl.dispose();
        }
        this.cameraControl = new OrbitControls(camera, this.renderer.domElement);
        this.cameraControl.enablePan = true;
        this.cameraControl.enableZoom = true;
        this.cameraControl.minDistance = -Infinity;
        this.cameraControl.maxDistance = Infinity;

        // eslint-disable-next-line no-unused-expressions
        this.cameraControl?.addEventListener('change', () => {
            requestAnimationFrame(() => this.draw());
        });

        return camera;
    }

    private fitCamera() {
        const boundingBox = new Box3(this.parser.min, this.parser.max);
        const center = new Vector3();
        boundingBox.getCenter(center);
        this.camera.position.x = (this.parser.min?.x || 0) + ((this.parser.max?.x || 0) - (this.parser.min?.x || 0)) / 2;
        this.camera.position.z = (this.parser.max?.z || 0);

        if (this.cameraControl) {
            this.cameraControl.target = center;
        }

        this.camera.lookAt(center);

        this.draw();
    }

    /**
     * Reads the GCode and renders it to a mesh.
     */
    public async render() {
        this.parser.parse();

        this.parser.getGeometries().forEach(g => {
            this.scene.add(new Mesh(g, this.lineMaterial));
        });

        // Set up some lights.
        const ambientLight = new AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const spotLight = new SpotLight(0xffffff, 0.9);
        spotLight.position.set(200, 400, 300);
        spotLight.lookAt(new Vector3(0, 0, 0));

        const spotLight2 = new SpotLight(0xffffff, 0.9);
        spotLight2.position.set(-200, -400, -300);
        spotLight2.lookAt(new Vector3(0, 0, 0));
        this.scene.add(spotLight);
        this.scene.add(spotLight2);

        this.fitCamera();
    }

    private draw() {
        if (this.parser.getGeometries().length === 0 || this.camera === undefined) {
            return;
        }

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Slices the rendered model based on the passed start and end point numbers.
     * (0, pointsCount()) renders everything
     *
     * Note: Currently negative values are not allowed.
     *
     * @param {number} start the starting segment
     * @param {number} end the ending segment (excluding)
     */
    public slice(start: number = 0, end: number = this.pointsCount()) {
        this.parser.slice(start, end);
        this.draw();
    }

    /**
     * Slices the rendered model based on the passed start and end line numbers.
     * (0, layerCount()) renders everything
     *
     * Note: Currently negative values are not allowed.
     *
     * @param {number} start the starting layer
     * @param {number} end the ending layer (excluding)
     */
    public sliceLayer(start?: number, end?: number) {
        this.parser.sliceLayer(start, end);
        this.draw();
    }

    /**
     * Retrieve the dom html canvas element where
     * the GCode viewer draws to.
     * @returns {HTMLCanvasElement}
     */
    public element(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    /**
     * disposes everything which is dispose able.
     * Call this always before destroying the instance.""
     */
    public dispose() {
        // eslint-disable-next-line no-unused-expressions
        this.cameraControl?.dispose();
        this.parser.dispose();
    }

    /**
     * Get the amount of points in the model.
     *
     * @returns {number}
     */
    public pointsCount(): number {
        return this.parser.pointsCount();
    }

    /**
     * Get the amount of layers in the model.
     * This is an approximation which may be incorrect if the
     * nozzle moves downwards mid print.
     *
     * @returns {number}
     */
    public layerCount(): number {
        return this.parser.layerCount();
    }

    /**
     * This can be called when a resize of the canvas is needed.
     *
     * @param {number} width
     * @param {number} height
     */
    public resize(width: number, height: number) {
        this.renderer.setSize(width, height);

        const rot = this.camera.rotation;
        const pos = this.camera.position;
        this.camera = this.newCamera(width, height);
        this.fitCamera();

        this.camera.rotation.copy(rot);
        this.camera.position.copy(pos);

        this.draw();
    }
}
