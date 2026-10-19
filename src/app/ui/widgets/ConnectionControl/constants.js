import constants from 'namespace-constants';

// Modal
export const {
    MODAL_NONE,
    MODAL_SETTINGS
} = constants('widgets/Control', [
    'MODAL_NONE',
    'MODAL_SETTINGS'
]);

// mm (or in)
export const DISTANCE_MIN = 0;
export const DISTANCE_MAX = 10000;
export const DISTANCE_STEP = 1;

// Control
export const DEFAULT_AXES = ['x', 'y', 'z'];

// Shared by the step selector and command generation so hidden values cannot be used.
export const ANGLE_OPTIONS = ['5', '1', '0.2'];
export const getDistanceOptions = (isFourAxis) => [isFourAxis ? '5' : '10', '1', '0.1', '0.05'];
