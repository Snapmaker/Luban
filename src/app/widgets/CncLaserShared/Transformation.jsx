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
        selectedModelID: PropTypes.string,
        selectedModelHideFlag: PropTypes.bool,
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

        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
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
        onChangeWidth: (width) => {
            this.props.updateSelectedModelTransformation({ width }, {
                width: this.props.transformation.width,
                height: this.props.transformation.height
            });
        },
        onChangeHeight: (height) => {
            this.props.updateSelectedModelTransformation({ height }, {
                width: this.props.transformation.width,
                height: this.props.transformation.height
            });
        },
        onChangeRotationZ: (degreeStr) => {
            const degree = parseInt(degreeStr, 10);
            const rotationZ = (!degree) ? 0 : degree * Math.PI / 180;
            this.props.updateSelectedModelTransformation({ rotationZ });
        },
        onChangePositionX: (positionX) => {
            this.props.updateSelectedModelTransformation({ positionX });
        },
        onChangePositionY: (positionY) => {
            this.props.updateSelectedModelTransformation({ positionY });
        },
        onChangeFlip: (option) => {
            this.props.updateSelectedModelFlip({ flip: option.value, svgflip: option.svgflip });
        },
        onChangeUniformScalingState: (uniformScalingState) => {
            this.props.updateSelectedModelUniformScalingState({ uniformScalingState });
        },
        onModelAfterTransform: () => {
            this.props.onModelAfterTransform();
        }
    };

    render() {
        const { size, selectedModelID, selectedModelHideFlag, sourceType } = this.props;
        const { rotationZ, width = 125, height = 125, positionX = 0, positionY = 0, flip = 0, uniformScalingState = false } = this.props.transformation;
        const canResize = sourceType !== 'text';
        const selectedNotHide = selectedModelID && !selectedModelHideFlag;
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
                                style={{ width: '80px' }}
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
                                className={styles['description-text']}
                                style={{ marginLeft: '-15px', width: '15px', textAlign: 'center' }}
                            >
                                X
                            </span>
                            <span
                                className={styles['description-text']}
                                style={{ width: '32px', textAlign: 'center', display: 'inline-block' }}
                            />
                            <Input
                                style={{ width: '80px' }}
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
                                className={styles['description-text']}
                                style={{ marginLeft: '-15px', width: '15px', textAlign: 'center' }}
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
                                    style={{ width: '80px' }}
                                    disabled={!selectedNotHide || canResize === false}
                                    value={toFixed(width, 1)}
                                    min={1}
                                    max={size.x}
                                    onChange={(value) => {
                                        actions.onChangeWidth(value);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['description-text']}
                                    style={{ marginLeft: '-18px', width: '18px', textAlign: 'center' }}
                                >
                                   W
                                </span>
                                <button
                                    type="button"
                                    disabled={!selectedNotHide}
                                    className={uniformScalingState ? styles.icon_size_lock : styles.icon_size_unlock}
                                    style={{ height: '22px', width: '22px', display: 'inline-block', 'verticalAlign': 'middle', marginLeft: '7px', marginRight: '2px' }}
                                    onClick={() => {
                                        actions.onChangeUniformScalingState(!uniformScalingState);
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <Input
                                    style={{ width: '80px' }}
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
                                    className={styles['description-text']}
                                    style={{ marginLeft: '-16px', width: '15px', textAlign: 'center' }}
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
                                    style={{ width: '80px', height: '30px' }}
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
                                    style={{ width: '25px', textAlign: 'center', display: 'inline-block' }}
                                />
                                <button
                                    type="button"
                                    disabled={!selectedNotHide}
                                    className={styles.icon_flip_vertically}
                                    style={(flip & 2) ? { backgroundColor: '#E7F2FD' } : null}
                                    onClick={() => {
                                        actions.onChangeFlip({ value: (flip ^ 2), svgflip: 2 });
                                        actions.onModelAfterTransform();
                                    }}
                                />
                                <span
                                    className={styles['description-text']}
                                    style={{ width: '21px', textAlign: 'center', display: 'inline-block' }}
                                />
                                <button
                                    type="button"
                                    disabled={!selectedNotHide}
                                    className={styles.icon_flip_horizontal}
                                    style={(flip & 1) ? { backgroundColor: '#E7F2FD' } : null}
                                    onClick={() => {
                                        actions.onChangeFlip({ value: (flip ^ 1), svgflip: 1 });
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

const mapStateToProps = (state) => {
    const machine = state.machine;

    return {
        size: machine.size
    };
};

export default connect(mapStateToProps)(Transformation);
