import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { BOUND_SIZE } from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';
import { toFixed } from '../../lib/numeric-utils';
import { actions } from '../../reducers/modules/laser';


class Transformation extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        rotation: PropTypes.number,
        width: PropTypes.number,
        height: PropTypes.number,
        translateX: PropTypes.number,
        translateY: PropTypes.number,
        canResize: PropTypes.bool,
        updateTransformation: PropTypes.func.isRequired
    };

    actions = {
        onChangeWidth: (width) => {
            this.props.updateTransformation({ width });
        },
        onChangeHeight: (height) => {
            this.props.updateTransformation({ height });
        },
        onChangeRotation: (rotation) => {
            this.props.updateTransformation({ rotation });
        },
        onChangeTranslateX: (translateX) => {
            this.props.updateTransformation({ translateX });
        },
        onChangeTranslateY: (translateY) => {
            this.props.updateTransformation({ translateY });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const { rotation, width, height, translateX, translateY, canResize } = this.props;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Size (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        disabled={canResize === false}
                                        value={toFixed(width, 1)}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        disabled={canResize === false}
                                        value={toFixed(height, 1)}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Rotation')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Rotation')}
                                    content={i18n._('Set the rotation of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={toFixed(rotation * 180 / Math.PI, 1)}
                                                min={-180}
                                                max={180}
                                                onChange={(degree) => {
                                                    actions.onChangeRotation(degree * Math.PI / 180);
                                                }}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={toFixed(rotation * 180 / Math.PI, 1)}
                                            min={-180}
                                            max={180}
                                            onChange={(degree) => {
                                                actions.onChangeRotation(degree * Math.PI / 180);
                                            }}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Translate X')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Translate X')}
                                    content={i18n._('Set the translation of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateX}
                                                min={-BOUND_SIZE / 2}
                                                max={BOUND_SIZE / 2}
                                                onChange={actions.onChangeTranslateX}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={translateX}
                                            min={-BOUND_SIZE / 2}
                                            max={BOUND_SIZE / 2}
                                            onChange={actions.onChangeTranslateX}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Translate Y')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Translate Y')}
                                    content={i18n._('Set the translation of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateY}
                                                min={-BOUND_SIZE / 2}
                                                max={BOUND_SIZE / 2}
                                                onChange={actions.onChangeTranslateY}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={translateY}
                                            min={-BOUND_SIZE / 2}
                                            max={BOUND_SIZE / 2}
                                            onChange={actions.onChangeTranslateY}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { model, transformation } = state.laser;
    const { rotation, width, height, translateX, translateY, canResize } = transformation;
    return {
        model: model,
        rotation: rotation,
        width: width,
        height: height,
        translateX: translateX,
        translateY: translateY,
        canResize: canResize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateTransformation: (params) => dispatch(actions.updateTransformation(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Transformation);

