import React, { PureComponent } from 'react';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import * as THREE from 'three';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions as printingActions } from '../../reducers/printing';


class VisualizerModelTransformation extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        model: PropTypes.object,
        hasModel: PropTypes.bool.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        positionX: PropTypes.number.isRequired,
        positionZ: PropTypes.number.isRequired,
        rotationX: PropTypes.number.isRequired,
        rotationY: PropTypes.number.isRequired,
        rotationZ: PropTypes.number.isRequired,
        scale: PropTypes.number.isRequired,
        setTransformMode: PropTypes.func.isRequired
    };

    actions = {
        onModelTransform: (type, value) => {
            const { size } = this.props;
            const transformation = {};
            switch (type) {
                case 'moveX':
                    value = Math.min(Math.max(value, -size.x / 2), size.x / 2);
                    transformation.positionX = value;
                    break;
                case 'moveZ':
                    value = Math.min(Math.max(value, -size.z / 2), size.z / 2);
                    transformation.positionZ = value;
                    break;
                case 'scale':
                    transformation.scale = value;
                    break;
                case 'rotateX':
                    transformation.rotationX = value;
                    break;
                case 'rotateY':
                    transformation.rotationY = value;
                    break;
                case 'rotateZ':
                    transformation.rotationZ = value;
                    break;
                default:
                    break;
            }
            this.props.modelGroup.updateSelectedModelTransformation(transformation);
        },
        onModelAfterTransform: () => {
            this.props.modelGroup.onModelAfterTransform();
        },
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
        }
    };

    render() {
        const actions = this.actions;
        const { size, model, hasModel, positionX, positionZ, rotationX, rotationY, rotationZ, scale, transformMode } = this.props;
        const disabled = !(model && hasModel);
        const moveX = Number(positionX.toFixed(1));
        const moveZ = Number(positionZ.toFixed(1));
        const scalePercent = Number((scale * 100).toFixed(1));
        const rotateX = Number(THREE.Math.radToDeg(rotationX).toFixed(1));
        const rotateY = Number(THREE.Math.radToDeg(rotationY).toFixed(1));
        const rotateZ = Number(THREE.Math.radToDeg(rotationZ).toFixed(1));

        return (
            <React.Fragment>
                <div className={classNames(styles['model-transformation__container'], { [styles.disabled]: disabled })}>
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-move'],
                            {
                                [styles.selected]: transformMode === 'translate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('translate');
                        }}
                        disabled={disabled}
                    />
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-scale'],
                            {
                                [styles.selected]: transformMode === 'scale'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('scale');
                        }}
                        disabled={disabled}
                    />
                    <Anchor
                        componentClass="button"
                        className={classNames(
                            styles['model-operation'],
                            styles['operation-rotate'],
                            {
                                [styles.selected]: transformMode === 'rotate'
                            }
                        )}
                        onClick={() => {
                            actions.setTransformMode('rotate');
                        }}
                        disabled={disabled}
                    />
                </div>
                {!disabled && transformMode === 'translate' && (
                    <div className={classNames(styles.panel, styles['move-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    value={moveX}
                                    onChange={(value) => {
                                        actions.onModelTransform('moveX', value);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-1']}>mm</span>
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#e83100'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={moveX}
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    step={0.1}
                                    onChange={(value) => {
                                        actions.onModelTransform('moveX', value);
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    value={moveZ}
                                    onChange={(value) => {
                                        actions.onModelTransform('moveZ', value);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-1']}>mm</span>
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#22ac38'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={moveZ}
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    step={0.1}
                                    onChange={(value) => {
                                        actions.onModelTransform('moveZ', value);
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                        </div>
                    </div>
                )}
                {!disabled && transformMode === 'scale' && (
                    <div className={classNames(styles.panel, styles['scale-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-blue'])}>S</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={0}
                                    value={scalePercent}
                                    onChange={(value) => {
                                        actions.onModelTransform('scale', value / 100);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-2']}>%</span>
                        </div>
                    </div>
                )}
                {!disabled && transformMode === 'rotate' && (
                    <div className={classNames(styles.panel, styles['rotate-panel'])}>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-red'])}>X</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateX}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateX', THREE.Math.degToRad(degree));
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#e83100'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateX}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateX', THREE.Math.degToRad(degree));
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-green'])}>Y</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateZ}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateZ', THREE.Math.degToRad(degree));
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#22ac38'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateZ}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateZ', THREE.Math.degToRad(degree));
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                        </div>
                        <div className={styles.axis}>
                            <span className={classNames(styles['axis-label'], styles['axis-blue'])}>Z</span>
                            <span className={styles['axis-input-1']}>
                                <Input
                                    min={-180}
                                    max={180}
                                    value={rotateY}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateY', THREE.Math.degToRad(degree));
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                            <span className={styles['axis-unit-3']}>°</span>
                            <span className={styles['axis-slider']}>
                                <Slider
                                    handleStyle={{
                                        borderColor: 'white',
                                        backgroundColor: '#00b7ee'
                                    }}
                                    trackStyle={{
                                        backgroundColor: '#e9e9e9'
                                    }}
                                    value={rotateY}
                                    min={-180}
                                    max={180}
                                    step={0.1}
                                    onChange={(degree) => {
                                        actions.onModelTransform('rotateY', THREE.Math.degToRad(degree));
                                    }}
                                    onAfterChange={() => {
                                        actions.onModelAfterTransform();
                                    }}
                                />
                            </span>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const printing = state.printing;
    const {
        modelGroup, model, hasModel, gcodeLineGroup, transformMode,
        positionX, positionZ,
        rotationX, rotationY, rotationZ, scale
    } = printing;

    return {
        size: machine.size,
        modelGroup,
        model,
        hasModel,
        gcodeLineGroup,
        transformMode,
        positionX,
        positionZ,
        rotationX,
        rotationY,
        rotationZ,
        scale
    };
};

const mapDispatchToProps = (dispatch) => ({
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value))
});


export default connect(mapStateToProps, mapDispatchToProps)(VisualizerModelTransformation);
