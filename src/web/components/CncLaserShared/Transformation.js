import _ from 'lodash';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import TipTrigger from '../TipTrigger';
import { NumberInput as Input } from '../Input';
import styles from '../../widgets/LaserParams/styles.styl';
import { toFixed } from '../../lib/numeric-utils';


class Transformation extends PureComponent {
    static propTypes = {
        transformation: PropTypes.shape({
            rotation: PropTypes.number,
            width: PropTypes.number,
            height: PropTypes.number,
            translateX: PropTypes.number,
            translateY: PropTypes.number,
            canResize: PropTypes.bool
        }),
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        // redux
        size: PropTypes.object.isRequired,
    };

    actions = {
        onChangeWidth: (width) => {
            this.props.updateSelectedModelTransformation({ width });
        },
        onChangeHeight: (height) => {
            this.props.updateSelectedModelTransformation({ height });
        },
        onChangeRotation: (rotation) => {
            this.props.updateSelectedModelTransformation({ rotation });
        },
        onChangeTranslateX: (translateX) => {
            this.props.updateSelectedModelTransformation({ translateX });
        },
        onChangeTranslateY: (translateY) => {
            this.props.updateSelectedModelTransformation({ translateY });
        }
    };

    render() {
        if (_.isEmpty(this.props.transformation)) {
            return null;
        }

        const { size } = this.props;
        const { rotation, width, height, translateX, translateY, canResize } = this.props.transformation;
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
                                        max={size.x}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        disabled={canResize === false}
                                        value={toFixed(height, 1)}
                                        min={1}
                                        max={size.y}
                                        onChange={actions.onChangeHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Rotate')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Rotate')}
                                    content={i18n._('Rotate the image to the angle you need.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={rotation * 180 / Math.PI}
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
                                {i18n._('Move X (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Move X (mm)')}
                                    content={i18n._('Set the coordinate of the selected image or text in the X direction. You can also drag the image directly.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateX}
                                                min={-size.x / 2}
                                                max={size.x / 2}
                                                onChange={actions.onChangeTranslateX}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={toFixed(translateX, 1)}
                                            min={-size.x / 2}
                                            max={size.x / 2}
                                            onChange={actions.onChangeTranslateX}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Move Y (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Move Y (mm)')}
                                    content={i18n._('Set the coordinate of the selected image or text in the Y direction. You can also drag the image directly.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '75%', marginTop: '10px' }}>
                                            <Slider
                                                value={translateY}
                                                min={-size.y / 2}
                                                max={size.y / 2}
                                                onChange={actions.onChangeTranslateY}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '45px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={toFixed(translateY, 1)}
                                            min={-size.y / 2}
                                            max={size.y / 2}
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
    const machine = state.machine;

    return {
        size: machine.size
    };
};

export default connect(mapStateToProps)(Transformation);

