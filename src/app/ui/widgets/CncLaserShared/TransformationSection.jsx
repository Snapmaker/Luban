import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../../lib/i18n';
import { toFixed } from '../../../lib/numeric-utils';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { DegreeInput, NumberInput as Input } from '../../components/Input';

import { actions as editorActions } from '../../../flux/editor';

import styles from './styles.styl';

/**
 * Transformation section.
 *
 * This component is used for display properties of selected SVG elements.
 */
class TransformationSection extends PureComponent {
    static propTypes = {
        // headType: PropTypes.string.isRequired, // laser | cnc

        size: PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            z: PropTypes.number
        }).isRequired,
        selectedElements: PropTypes.array.isRequired,
        // element transformation
        selectedElementsTransformation: PropTypes.shape({
            x: PropTypes.number.isRequired,
            y: PropTypes.number.isRequired,
            width: PropTypes.number.isRequired,
            height: PropTypes.number.isRequired,
            scaleX: PropTypes.number.isRequired,
            scaleY: PropTypes.number.isRequired,
            angle: PropTypes.number.isRequired
        }).isRequired,
        // element actions
        elementActions: PropTypes.shape({
            moveElementsImmediately: PropTypes.func.isRequired,
            resizeElementsImmediately: PropTypes.func.isRequired,
            flipElementsHorizontally: PropTypes.func.isRequired,
            flipElementsVertically: PropTypes.func.isRequired,
            rotateElementsImmediately: PropTypes.func.isRequired
        }),

        selectedModelArray: PropTypes.array,
        sourceType: PropTypes.string,
        transformation: PropTypes.shape({
            rotationZ: PropTypes.number,
            width: PropTypes.number,
            height: PropTypes.number,
            positionX: PropTypes.number,
            positionY: PropTypes.number,
            flip: PropTypes.number, // not used
            scaleX: PropTypes.number, // not used
            scaleY: PropTypes.number, // not used
            uniformScalingState: PropTypes.bool
        }),
        disabled: PropTypes.bool.isRequired,

        updateSelectedModelUniformScalingState: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },

        onChangeLogicalX: (logicalX) => {
            const elements = this.props.selectedElements;
            const x = logicalX + this.props.size.x;
            this.props.elementActions.moveElementsImmediately(elements, { newX: x });
        },

        onChangeLogicalY: (logicalY) => {
            const elements = this.props.selectedElements;
            const y = -logicalY + this.props.size.y;
            this.props.elementActions.moveElementsImmediately(elements, { newY: y });
        },

        onChangeWidth: (newWidth) => {
            const elements = this.props.selectedElements;

            if (elements.length === 1) {
                // TODO: save uniformScalingState in SVGModel
                if (this.props.transformation.uniformScalingState) {
                    const { width, height, scaleX, scaleY } = this.props.selectedElementsTransformation;
                    const newHeight = height * Math.abs(scaleY) * (newWidth / width / Math.abs(scaleX));
                    this.props.elementActions.resizeElementsImmediately(elements, { newWidth, newHeight });
                } else {
                    this.props.elementActions.resizeElementsImmediately(elements, { newWidth });
                }
            }
        },
        onChangeHeight: (newHeight) => {
            const elements = this.props.selectedElements;

            if (elements.length === 1) {
                // TODO: save uniformScalingState in SVGModel
                if (this.props.transformation.uniformScalingState) {
                    const { width, height, scaleX, scaleY } = this.props.selectedElementsTransformation;
                    const newWidth = width * Math.abs(scaleX) * (newHeight / height / Math.abs(scaleY));
                    this.props.elementActions.resizeElementsImmediately(elements, { newWidth, newHeight });
                } else {
                    this.props.elementActions.resizeElementsImmediately(elements, { newHeight });
                }
            }
        },

        onChangeLogicalAngle: (logicalAngle) => {
            const newAngle = -logicalAngle;
            const elements = this.props.selectedElements;
            this.props.elementActions.rotateElementsImmediately(elements, { newAngle });
        },

        onFlipHorizontally: () => {
            const elements = this.props.selectedElements;
            this.props.elementActions.flipElementsHorizontally(elements);
        },

        onFlipVertically: () => {
            const elements = this.props.selectedElements;
            this.props.elementActions.flipElementsVertically(elements);
        },

        onChangeUniformScalingState: (uniformScalingState) => {
            this.props.updateSelectedModelUniformScalingState({ uniformScalingState });
        }
    };

    convertSVGPointToLogicalPoint(p, size) {
        return {
            x: p.x - size.x,
            y: -p.y + size.y
        };
    }

    render() {
        const { selectedElementsTransformation, size, selectedModelArray, sourceType, transformation, disabled } = this.props;

        const { x, y, width, height, scaleX, scaleY, angle } = selectedElementsTransformation;

        // calculate logical transformation
        // TODO: convert positions in flux
        const { x: logicalX, y: logicalY } = this.convertSVGPointToLogicalPoint({ x, y }, size);
        const logicalWidth = width * Math.abs(scaleX);
        const logicalHeight = height * Math.abs(scaleY);
        const logicalAngle = -angle;

        const { uniformScalingState = false } = transformation;

        const canResize = (sourceType !== 'text' && selectedModelArray.length === 1);
        const canRotate = (selectedModelArray.length === 1);

        const selectedNotHide = (selectedModelArray.length === 1) && selectedModelArray[0].visible || selectedModelArray.length > 1;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-arrows-alt sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Transformation')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <React.Fragment>
                        {/* X */}
                        <TipTrigger
                            title={i18n._('Move (mm)')}
                            content={i18n._('Set the coordinate of the selected image or text. You can also drag the image directly.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Move (mm)')}</span>
                                <div className="sm-parameter-row__label-r">
                                    <div className={styles['input-box-left']}>
                                        <Input
                                            disabled={disabled || !selectedNotHide}
                                            value={toFixed(logicalX, 1)}
                                            min={-size.x}
                                            max={size.x}
                                            onChange={(value) => {
                                                actions.onChangeLogicalX(value);
                                            }}
                                        />
                                        <span
                                            className={styles['input-box-inner-text']}
                                            style={{ marginLeft: '-15px' }}
                                        >
                                            X
                                        </span>
                                    </div>
                                    <span
                                        className={styles['description-text']}
                                        style={{ marginLeft: '6px', width: '20px', textAlign: 'center', display: 'inline-block' }}
                                    />
                                    <div className={styles['input-box-left']}>
                                        <Input
                                            disabled={disabled || !selectedNotHide}
                                            value={toFixed(logicalY, 1)}
                                            min={-size.y}
                                            max={size.y}
                                            onChange={(value) => {
                                                actions.onChangeLogicalY(value);
                                            }}
                                        />
                                        <span
                                            className={styles['input-box-inner-text']}
                                            style={{ marginLeft: '-15px' }}
                                        >
                                            Y
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Size')}
                            content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Size (mm)')}</span>
                                <div className="sm-parameter-row__label-r">
                                    <div className={styles['input-box-left']}>
                                        <Input
                                            disabled={disabled || !selectedNotHide || canResize === false}
                                            value={toFixed(logicalWidth, 1)}
                                            min={1}
                                            max={size.x}
                                            onChange={(value) => {
                                                actions.onChangeWidth(value);
                                            }}
                                        />
                                        <span
                                            className={styles['input-box-inner-text']}
                                            style={{ marginLeft: '-17px' }}
                                        >
                                           W
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={disabled || !selectedNotHide || sourceType === 'raster'}
                                        className={uniformScalingState ? styles.icon_size_lock : styles.icon_size_unlock}
                                        style={{ height: '22px', width: '20px', display: 'inline-block', 'verticalAlign': 'middle', marginLeft: '4px', marginRight: '2px' }}
                                        onClick={() => {
                                            actions.onChangeUniformScalingState(!uniformScalingState);
                                        }}
                                    />
                                    <div className={styles['input-box-left']}>
                                        <Input
                                            disabled={disabled || !selectedNotHide || canResize === false}
                                            value={toFixed(logicalHeight, 1)}
                                            min={1}
                                            max={size.y}
                                            onChange={(value) => {
                                                actions.onChangeHeight(value);
                                            }}
                                        />
                                        <span
                                            className={styles['input-box-inner-text']}
                                            style={{ marginLeft: '-16px' }}
                                        >
                                           H
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Rotate')}
                            content={i18n._('Rotate the image to the angle you need.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Rotate')}</span>
                                <div className="sm-parameter-row__label-r">
                                    <div className={styles['input-box-left']}>
                                        <DegreeInput
                                            disabled={disabled || !selectedNotHide || !canRotate}
                                            value={toFixed(logicalAngle, 1)}
                                            suffix="°"
                                            onChange={actions.onChangeLogicalAngle}
                                        />
                                    </div>
                                    <span
                                        className={styles['description-text']}
                                        style={{ width: '28px', textAlign: 'center', display: 'inline-block' }}
                                    />
                                    {selectedModelArray.length !== 1 && (
                                        <span
                                            className={styles['description-text']}
                                            style={{ width: '80px', textAlign: 'center', display: 'inline-block' }}
                                        />
                                    )}
                                    {selectedModelArray.length === 1 && (
                                        <button
                                            type="button"
                                            disabled={disabled || !selectedNotHide}
                                            className={styles.icon_flip_vertically}
                                            onClick={actions.onFlipHorizontally}
                                        />
                                    )}
                                    {selectedModelArray.length === 1 && (
                                        <span
                                            className={styles['description-text']}
                                            style={{ width: '20px', textAlign: 'center', display: 'inline-block' }}
                                        />
                                    )}
                                    {selectedModelArray.length === 1 && (
                                        <button
                                            type="button"
                                            disabled={disabled || !selectedNotHide}
                                            className={styles.icon_flip_horizontal}
                                            onClick={actions.onFlipVertically}
                                        />
                                    )}
                                </div>
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { headType } = ownProps;

    const machine = state.machine;
    const { modelGroup, SVGActions } = state[headType];

    const selectedElements = SVGActions.getSelectedElements();
    const selectedElementsTransformation = SVGActions.getSelectedElementsTransformation();

    const transformation = modelGroup.getSelectedModelTransformation();
    const selectedModelArray = modelGroup.getSelectedModelArray();

    const sourceType = (selectedModelArray.length === 1) ? selectedModelArray[0].sourceType : null;
    const visible = (selectedModelArray.length === 1) ? selectedModelArray[0].visible : null;

    return {
        size: machine.size,
        selectedElements,
        selectedElementsTransformation,
        selectedModelArray,
        sourceType,
        visible,
        transformation,
        modelGroup
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { headType } = ownProps;

    return {
        elementActions: {
            moveElementsImmediately: (elements, options) => dispatch(editorActions.moveElementsImmediately(headType, elements, options)),
            resizeElementsImmediately: (elements, options) => dispatch(editorActions.resizeElementsImmediately(headType, elements, options)),
            flipElementsHorizontally: (elements, options) => dispatch(editorActions.flipElementsHorizontally(headType, elements, options)),
            flipElementsVertically: (elements, options) => dispatch(editorActions.flipElementsVertically(headType, elements, options)),
            rotateElementsImmediately: (elements, options) => dispatch(editorActions.rotateElementsImmediately(headType, elements, options))
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TransformationSection);
