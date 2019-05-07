import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import styles from './styles.styl';


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

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onChangeWidth: (width) => {
            this.props.updateSelectedModelTransformation({ width });
        },
        onChangeHeight: (height) => {
            this.props.updateSelectedModelTransformation({ height });
        },
        onChangeRotation: (degree) => {
            const rotation = degree * Math.PI / 180;
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
        const { size } = this.props;
        const { rotation, width, height, translateX, translateY, canResize } = this.props.transformation;
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
                            title={i18n._('Size')}
                            content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Size (mm)')}</span>
                                <Input
                                    style={{ width: '90px' }}
                                    disabled={canResize === false}
                                    value={toFixed(width, 1)}
                                    min={1}
                                    max={size.x}
                                    onChange={actions.onChangeWidth}
                                />
                                <span
                                    className={styles['description-text']}
                                    style={{ width: '22px', textAlign: 'center', display: 'inline-block' }}
                                >
                                    X
                                </span>
                                <Input
                                    style={{ width: '90px' }}
                                    disabled={canResize === false}
                                    value={toFixed(height, 1)}
                                    min={1}
                                    max={size.y}
                                    onChange={actions.onChangeHeight}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Rotate')}
                            content={i18n._('Rotate the image to the angle you need.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Rotate')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={toFixed(rotation * 180 / Math.PI, 1)}
                                    min={-180}
                                    max={180}
                                    onChange={actions.onChangeRotation}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={rotation * 180 / Math.PI}
                                    min={-180}
                                    max={180}
                                    onChange={actions.onChangeRotation}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Move X (mm)')}
                            content={i18n._('Set the coordinate of the selected image or text in the X direction. You can also drag the image directly.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Move X (mm)')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={toFixed(translateX, 1)}
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    onChange={actions.onChangeTranslateX}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={translateX}
                                    min={-size.x / 2}
                                    max={size.x / 2}
                                    onChange={actions.onChangeTranslateX}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Move Y (mm)')}
                            content={i18n._('Set the coordinate of the selected image or text in the Y direction. You can also drag the image directly.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Move Y (mm)')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    value={toFixed(translateY, 1)}
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    onChange={actions.onChangeTranslateY}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={translateY}
                                    min={-size.y / 2}
                                    max={size.y / 2}
                                    onChange={actions.onChangeTranslateY}
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
