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


class Transformation extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired
    };

    modelGroup = null;

    state = {
        // transformation
        rotation: 0,
        width: 0,
        height: 0,
        translateX: 0,
        translateY: 0
    };

    componentDidMount() {
        this.modelGroup = this.props.modelGroup;
        this.modelGroup.addChangeListener((newState) => {
            const { model } = newState;
            if (model) {
                const { transformation } = newState;
                this.setState({
                    rotation: transformation.rotation,
                    width: transformation.width,
                    height: transformation.height,
                    translateX: transformation.translateX,
                    translateY: transformation.translateY
                });
            }
        });
    }

    actions = {
        onChangeWidth: (width) => {
            this.modelGroup.transformSelectedModel({ width });
        },
        onChangeHeight: (height) => {
            this.modelGroup.transformSelectedModel({ height });
        },
        onChangeRotation: (rotation) => {
            this.modelGroup.transformSelectedModel({ rotation });
        },
        onChangeTranslateX: (translateX) => {
            this.modelGroup.transformSelectedModel({ translateX });
        },
        onChangeTranslateY: (translateY) => {
            this.modelGroup.transformSelectedModel({ translateY });
        }
    };

    render() {
        const { rotation, width, height, translateX, translateY } = this.state;
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
                                        value={width}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={height}
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
                                        <div style={{ display: 'inline-block', width: '80%', marginTop: '10px' }}>
                                            <Slider
                                                value={rotation}
                                                min={0}
                                                max={360}
                                                onChange={actions.onChangeRotation}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '35px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={rotation}
                                            min={0}
                                            max={360}
                                            onChange={actions.onChangeRotation}
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
                                        <div style={{ display: 'inline-block', width: '80%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateX}
                                                min={0}
                                                max={BOUND_SIZE}
                                                onChange={actions.onChangeTranslateX}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '35px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={translateX}
                                            min={0}
                                            max={BOUND_SIZE}
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
                                        <div style={{ display: 'inline-block', width: '80%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateY}
                                                min={0}
                                                max={BOUND_SIZE}
                                                onChange={actions.onChangeTranslateY}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '35px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={translateY}
                                            min={0}
                                            max={BOUND_SIZE}
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
    return {
        modelGroup: state.laser.modelGroup
    };
};

export default connect(mapStateToProps)(Transformation);
