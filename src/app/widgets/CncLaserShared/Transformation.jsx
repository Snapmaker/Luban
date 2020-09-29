import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input, DegreeInput } from '../../components/Input';
import styles from './styles.styl';

class Transformation extends PureComponent {
    static propTypes = {
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

        updateSelectedModelTransformation: PropTypes.func.isRequired,
        // updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        // onModelAfterTransform: PropTypes.func.isRequired,
        // redux
        size: PropTypes.shape({
            x: PropTypes.number,
            y: PropTypes.number,
            z: PropTypes.number
        }).isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        // dont set width and height on transform
        onChangeWidth: (width) => {
            const selectedModelArray = this.props.selectedModelArray;
            if (selectedModelArray && selectedModelArray.length === 1) {
                if (this.props.transformation.uniformScalingState) {
                    this.props.updateSelectedModelTransformation({
                        width,
                        height: this.props.transformation.height * width / this.props.transformation.width,
                        scaleX: this.props.transformation.scaleX * width / this.props.transformation.width,
                        scaleY: this.props.transformation.scaleY * width / this.props.transformation.width
                    });
                } else {
                    this.props.updateSelectedModelTransformation({ width, scaleX: this.props.transformation.scaleX * width / this.props.transformation.width });
                }
            }
        },
        onChangeHeight: (height) => {
            const selectedModelArray = this.props.selectedModelArray;
            if (selectedModelArray && selectedModelArray.length === 1) {
                if (this.props.transformation.uniformScalingState) {
                    this.props.updateSelectedModelTransformation({
                        height,
                        width: this.props.transformation.width * height / this.props.transformation.height,
                        scaleY: this.props.transformation.scaleY * height / this.props.transformation.height,
                        scaleX: this.props.transformation.scaleX * height / this.props.transformation.height
                    });
                } else {
                    this.props.updateSelectedModelTransformation({ height, scaleY: this.props.transformation.scaleY * height / this.props.transformation.height });
                }
            }
        },
        onChangeRotationZ: (degree) => {
            const rotationZ = degree * Math.PI / 180;
            this.props.updateSelectedModelTransformation({ rotationZ });
        },
        onChangePositionX: (positionX) => {
            // if (positionX) {
            //     return;
            // }
            this.props.updateSelectedModelTransformation({ positionX });
        },
        onChangePositionY: (positionY) => {
            this.props.updateSelectedModelTransformation({ positionY });
        },
        onChangeFlip: (key) => {
            const selectedModelArray = this.props.selectedModelArray;
            if (selectedModelArray && selectedModelArray.length === 1) {
                this.props.updateSelectedModelTransformation({ [key]: selectedModelArray[0].transformation[key] * -1 });
            }
        },
        onChangeUniformScalingState: (uniformScalingState) => {
            this.props.updateSelectedModelUniformScalingState({ uniformScalingState });
        },
        onModelAfterTransform: () => {
            // this.props.onModelAfterTransform();
        }
    };

    render() {
        const { size, selectedModelArray, sourceType } = this.props;
        const { rotationZ = 0, width = 125, height = 125, positionX = 0, positionY = 0, uniformScalingState = false } = this.props.transformation;
        const canResize = (sourceType !== 'text' && selectedModelArray.length === 1);
        const selectedNotHide = (selectedModelArray.length === 1) && selectedModelArray[0].visible || selectedModelArray.length > 1;
        const actions = this.actions;
        return (
            <React.Fragment>
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
                        <TipTrigger
                            title={i18n._('Move (mm)')}
                            content={i18n._('Set the coordinate of the selected image or text. You can also drag the image directly.')}
                        >
                            <span className="sm-parameter-row__label">{i18n._('Move (mm)')}</span>
                            <Input
                                className={styles['input-box-left']}
                                disabled={!selectedNotHide}
                                value={toFixed(positionX, 1)}
                                min={-size.x}
                                max={size.x}
                                onChange={(value) => {
                                    actions.onChangePositionX(value);
                                    actions.onModelAfterTransform();
                                }}
                            />
                            <span
                                className={styles['input-box-inner-text']}
                                style={{ marginLeft: '-15px' }}
                            >
                                X
                            </span>
                            <span
                                className={styles['description-text']}
                                style={{ marginLeft: '6px', width: '32px', textAlign: 'center', display: 'inline-block' }}
                            />
                            <Input
                                className={styles['input-box-right']}
                                disabled={!selectedNotHide}
                                value={toFixed(positionY, 1)}
                                min={-size.y}
                                max={size.y}
                                onChange={(value) => {
                                    actions.onChangePositionY(value);
                                    actions.onModelAfterTransform();
                                }}
                            />
                            <span
                                className={styles['input-box-inner-text']}
                                style={{ marginLeft: '-15px' }}
                            >
                                Y
                            </span>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Size')}
                            content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Size (mm)')}</span>
                                <Input
                                    className={styles['input-box-left']}
                                    disabled={!selectedNotHide || canResize === false}
                                    value={toFixed(width, 1)}
                                    min={1}
                                    max={size.x}
                                    onChange={(value) => {
                                        actions.onChangeWidth(value);
                                        // actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                    style={{ marginLeft: '-17px' }}
                                >
                                   W
                                </span>
                                <button
                                    type="button"
                                    disabled={!selectedNotHide || sourceType === 'raster'}
                                    className={uniformScalingState ? styles.icon_size_lock : styles.icon_size_unlock}
                                    style={{ height: '22px', width: '22px', display: 'inline-block', 'verticalAlign': 'middle', marginLeft: '10px', marginRight: '5px' }}
                                    onClick={() => {
                                        actions.onChangeUniformScalingState(!uniformScalingState);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <Input
                                    className={styles['input-box-right']}
                                    disabled={!selectedNotHide || canResize === false}
                                    value={toFixed(height, 1)}
                                    min={1}
                                    max={size.y}
                                    onChange={(value) => {
                                        actions.onChangeHeight(value);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                    style={{ marginLeft: '-16px' }}
                                >
                                   H
                                </span>
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Rotate')}
                            content={i18n._('Rotate the image to the angle you need.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Rotate')}</span>
                                <DegreeInput
                                    className={styles['input-box-left']}
                                    disabled={!selectedNotHide}
                                    value={rotationZ ? toFixed(rotationZ * 180 / Math.PI, 1) : 0}
                                    suffix="°"
                                    onChange={(value) => {
                                        actions.onChangeRotationZ(value);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['description-text']}
                                    style={{ width: '31px', textAlign: 'center', display: 'inline-block' }}
                                />
                                {selectedModelArray.length === 1 && (
                                    <button
                                        type="button"
                                        disabled={!selectedNotHide}
                                        className={styles.icon_flip_vertically}
                                        onClick={() => {
                                            actions.onChangeFlip('scaleX');
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                )}
                                {selectedModelArray.length === 1 && (
                                    <span
                                        className={styles['description-text']}
                                        style={{ width: '26px', textAlign: 'center', display: 'inline-block' }}
                                    />
                                )}
                                {selectedModelArray.length === 1 && (
                                    <button
                                        type="button"
                                        disabled={!selectedNotHide}
                                        className={styles.icon_flip_horizontal}
                                        onClick={() => {
                                            actions.onChangeFlip('scaleY');
                                            actions.onModelAfterTransform();
                                        }}
                                    />
                                )}
                            </div>
                        </TipTrigger>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, props) => {
    const { headType } = props;
    const machine = state.machine;
    const { modelGroup } = state[headType];
    const transformation = modelGroup.getSelectedModelTransformation();
    const selectedModelArray = modelGroup.getSelectedModelArray();
    // const { modelID, sourceType, visible } = selectedModel;
    const sourceType = (selectedModelArray.length === 1) ? selectedModelArray[0].sourceType : null;
    const visible = (selectedModelArray.length === 1) ? selectedModelArray[0].visible : null;
    return {
        size: machine.size,
        selectedModelArray,
        sourceType,
        visible,
        transformation,
        modelGroup
    };
};

export default connect(mapStateToProps)(Transformation);
