import { expose } from 'threads/worker';

import arrangeModels from '../../workers/arrangeModels';
import autoRotateModels from '../../workers/autoRotateModels';
import boxSelect from '../../workers/boxSelect';
import gcodeToArraybufferGeometry from '../../workers/gcodeToArraybufferGeometry';
import gcodeToBufferGeometry from '../../workers/gcodeToBufferGeometry';
import loadModel from '../../workers/loadModel';
import scaleToFitWithRotate from '../../workers/scaleToFitWithRotate';
import toolpathRenderer from '../../workers/toolpathRenderer';
import generatePlateAdhesion from '../../workers/generatePlateAdhesion';


expose({
    arrangeModels,
    autoRotateModels,
    boxSelect,
    gcodeToArraybufferGeometry,
    gcodeToBufferGeometry,
    loadModel,
    scaleToFitWithRotate,
    toolpathRenderer,
    generatePlateAdhesion
});
