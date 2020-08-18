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
        // selectedModelID: PropTypes.string,
        // selectedModelVisible: PropTypes.bool,
        selectedModel: PropTypes.object,
        modelID: PropTypes.string,
        sourceType: PropTypes.string.isRequired,
        transformation: PropTypes.shape({
            rotationZ: PropTypes.number,
            width: PropTypes.number,
            height: PropTypes.number,
            positionX: PropTypes.number,
            positionY: PropTypes.number,
            flip: PropTypes.number,
            uniformScalingState: PropTypes.bool
        }),

        // updateSelectedModelTransformation: PropTypes.func.isRequired,
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
            const { selectedModel } = this.props;

            if (selectedModel.modelID) {
                selectedModel.updateAndRefresh({ transformation: { scaleX: width / selectedModel.transformation.width } });
            }
        },
        onChangeHeight: (height) => {
            const { selectedModel } = this.props;

            if (selectedModel.modelID) {
                selectedModel.updateAndRefresh({ transformation: { scaleY: height / selectedModel.transformation.height } });
            }
        },
        onChangeRotationZ: (degree) => {
            const rotationZ = degree * Math.PI / 180;
            if (this.props.selectedModel.modelID) {
                this.props.selectedModel.updateAndRefresh({ transformation: { rotationZ } });
            }
        },
        onChangePositionX: (positionX) => {
            if (this.props.selectedModel.modelID) {
                this.props.selectedModel.updateAndRefresh({ transformation: { positionX } });
            }
        },
        onChangePositionY: (positionY) => {
            if (this.props.selectedModel.modelID) {
                this.props.selectedModel.updateAndRefresh({ transformation: { positionY } });
            }
        },
        onChangeFlip: (key) => {
            const model = this.props.selectedModel;
            if (model.modelID) {
                model.updateAndRefresh({
                    transformation: {
                        [key]: model.transformation[key] * -1
                    }
                });
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
        const { size, selectedModel, sourceType } = this.props;
        const { rotationZ = 0, width = 125, height = 125, positionX = 0, positionY = 0, flip = 0, uniformScalingState = false } = this.props.transformation;
        const canResize = sourceType !== 'text';
        const selectedNotHide = selectedModel.modelID && selectedModel.visible;
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
                                style={{ 'margin-left': '6px', width: '32px', textAlign: 'center', display: 'inline-block' }}
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
                                    disabled={!selectedNotHide}
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
                                    value={rotationZ ? toFixed(rotationZ * 180 / Math.PI, 1).toString() : '0'}
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
                                <button
                                    type="button"
                                    disabled={!selectedNotHide}
                                    className={styles.icon_flip_vertically}
                                    style={(flip & 2) ? { backgroundColor: '#E7F2FD' } : null}
                                    onClick={() => {
                                        actions.onChangeFlip('scaleX');
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['description-text']}
                                    style={{ width: '26px', textAlign: 'center', display: 'inline-block' }}
                                />
                                <button
                                    type="button"
                                    disabled={!selectedNotHide}
                                    className={styles.icon_flip_horizontal}
                                    style={(flip & 1) ? { backgroundColor: '#E7F2FD' } : null}
                                    onClick={() => {
                                        actions.onChangeFlip('scaleY');
                                        actions.onModelAfterTransform();
                                    }}
                                />
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
    const selectedModel = modelGroup.getSelectedModel();
    const { modelID, sourceType, visible, transformation } = selectedModel;
    return {
        size: machine.size,
        selectedModel,
        modelID,
        sourceType,
        visible,
        transformation
    };
};

export default connect(mapStateToProps)(Transformation);
