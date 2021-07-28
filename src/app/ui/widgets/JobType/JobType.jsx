import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
// import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import { toFixed } from '../../../lib/numeric-utils';
// import styles from './styles.styl';
import {
    COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_LEFT, COORDINATE_MODE_BOTTOM_RIGHT, COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT, COORDINATE_MODE_BOTTOM_CENTER, HEAD_LASER
} from '../../../constants';
import { NumberInput as Input } from '../../components/Input';
import Select from '../../components/Select';

class JobType extends PureComponent {
    static propTypes = {
        headType: PropTypes.string.isRequired,

        size: PropTypes.object.isRequired,

        inProgress: PropTypes.bool.isRequired,

        jobTypeState: PropTypes.object.isRequired, // { materials, coordinateMode, coordinateSize }
        useBackground: PropTypes.bool, // only laser
        setJobTypeState: PropTypes.func.isRequired
    };

    coordinateModeList = [
        {
            label: COORDINATE_MODE_CENTER.value,
            value: i18n._(COORDINATE_MODE_CENTER.label),
            mode: COORDINATE_MODE_CENTER
        },
        {
            label: COORDINATE_MODE_BOTTOM_LEFT.value,
            value: i18n._(COORDINATE_MODE_BOTTOM_LEFT.label),
            mode: COORDINATE_MODE_BOTTOM_LEFT
        },
        {
            label: COORDINATE_MODE_BOTTOM_RIGHT.value,
            value: i18n._(COORDINATE_MODE_BOTTOM_RIGHT.label),
            mode: COORDINATE_MODE_BOTTOM_RIGHT
        },
        {
            label: COORDINATE_MODE_TOP_LEFT.value,
            value: i18n._(COORDINATE_MODE_TOP_LEFT.label),
            mode: COORDINATE_MODE_TOP_LEFT
        },
        {
            label: COORDINATE_MODE_TOP_RIGHT.value,
            value: i18n._(COORDINATE_MODE_TOP_RIGHT.label),
            mode: COORDINATE_MODE_TOP_RIGHT
        }
    ];

    state = {
    };

    actions = {
        changeCoordinateMode: (option) => {
            const newCoordinateMode = this.coordinateModeList.find(d => d.value === option.value);
            const coordinateSize = {
                x: this.props.size.x,
                y: this.props.size.y
            };
            this.actions.setCoordinateModeAndCoordinateSize(newCoordinateMode.mode, coordinateSize);
        },
        setMaterials: (materials) => {
            materials = {
                ...this.props.jobTypeState.materials,
                ...materials
            };
            this.props.setJobTypeState({
                ...this.props.jobTypeState,
                materials
            });
        },
        setCoordinateMode: (coordinateMode) => {
            this.props.setJobTypeState({
                ...this.props.jobTypeState,
                coordinateMode
            });
        },
        setCoordinateSize: (coordinateSize) => {
            this.props.setJobTypeState({
                ...this.props.jobTypeState,
                coordinateSize
            });
        },
        setCoordinateModeAndCoordinateSize: (coordinateMode, coordinateSize) => {
            this.props.setJobTypeState({
                ...this.props.jobTypeState,
                coordinateMode,
                coordinateSize
            });
        },
        setJobTypeState: (coordinateMode, coordinateSize, materials) => {
            materials = {
                ...this.props.jobTypeState.materials,
                ...materials
            };
            this.props.setJobTypeState({
                ...this.props.jobTypeState,
                coordinateMode,
                coordinateSize,
                materials
            });
        }
    };

    render() {
        const { size, inProgress, jobTypeState, headType, useBackground } = this.props;
        const { materials, coordinateMode, coordinateSize } = jobTypeState;
        const { isRotate, diameter, length } = materials;

        let imgOF3axisCoordinateMode = '';
        if (!isRotate) {
            imgOF3axisCoordinateMode = `/resources/images/cnc-laser/working-origin-3-${coordinateMode.value}.png`;
        }

        let settingSizeDisabled = false;
        if (useBackground) {
            settingSizeDisabled = true;
        }

        return (
            <React.Fragment>
                {!isRotate && (
                    <div className="margin-left-50">
                        <div className="margin-bottom-16 font-weight-bold">
                            {i18n._('Working size')}
                        </div>
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '100px',
                                    height: '100px'
                                }}
                                src="/resources/images/cnc-laser/working-size-3.png"
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16 sm-flex-width">
                                <div className="sm-flex height-32 position-re">
                                    <span className="width-88 margin-right-8">{i18n._('Width (X)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed(coordinateSize.x, 1)}
                                        max={size.x}
                                        min={2}
                                        onChange={(value) => {
                                            this.actions.setCoordinateModeAndCoordinateSize(
                                                coordinateMode, {
                                                    x: value,
                                                    y: coordinateSize.y
                                                }
                                            );
                                        }}
                                    />
                                </div>
                                <div className="sm-flex height-32 position-re margin-top-16">
                                    <span className="width-88 margin-right-8">{i18n._('Height (Y)')}</span>
                                    <Input
                                        suffix="mm"
                                        disabled={inProgress || settingSizeDisabled}
                                        value={toFixed(coordinateSize.y, 1)}
                                        max={size.y}
                                        min={10}
                                        onChange={(value) => {
                                            this.actions.setCoordinateModeAndCoordinateSize(
                                                coordinateMode, {
                                                    x: coordinateSize.x,
                                                    y: value
                                                }
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="margin-top-24 margin-bottom-16 font-weight-bold">
                            {i18n._('Working origin')}
                        </div>
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '100px',
                                    height: '100px'
                                }}
                                src={imgOF3axisCoordinateMode}
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16 sm-flex-width sm-flex height-32">
                                <span className="width-88 margin-right-8">{i18n._('Zero zone')}</span>
                                <Select
                                    backspaceRemoves={false}
                                    size="120px"
                                    clearable={false}
                                    options={this.coordinateModeList}
                                    isGroup={false}
                                    placeholder={i18n._('Choose font')}
                                    value={i18n._(coordinateMode.label ?? COORDINATE_MODE_CENTER.label)}
                                    onChange={this.actions.changeCoordinateMode}
                                    disabled={inProgress || settingSizeDisabled}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {isRotate && (
                    <div className="margin-left-50">
                        <div className="margin-bottom-16 font-weight-bold">
                            {i18n._('Working size')}
                        </div>
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '330px',
                                    margin: '0 auto'
                                }}
                                src="/resources/images/cnc-laser/working-size-4.png"
                                role="presentation"
                                alt="3 Axis"
                            />
                        </div>
                        <div className="margin-top-16">
                            <div className="sm-flex height-32 position-re">
                                <span className="width-88 margin-right-8">{i18n._('Length (L)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(length, 1)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => {
                                        this.actions.setJobTypeState(
                                            COORDINATE_MODE_BOTTOM_CENTER, {
                                                x: diameter * Math.PI,
                                                y: value
                                            },
                                            { length: value }
                                        );
                                    }}
                                />
                            </div>
                            <div className="sm-flex height-32 position-re margin-top-8">
                                <span className="width-88 margin-right-8">{i18n._('Diameter (D)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(diameter, 1)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => {
                                        this.actions.setJobTypeState(
                                            COORDINATE_MODE_BOTTOM_CENTER, {
                                                x: value * Math.PI,
                                                y: length
                                            },
                                            { diameter: value }
                                        );
                                    }}
                                />
                            </div>
                        </div>
                        <div className="margin-top-24 margin-bottom-16 font-weight-bold">
                            {i18n._('Working origin')}
                        </div>
                        <div className="sm-flex">
                            <img
                                draggable="false"
                                style={{
                                    width: '116px',
                                    height: '128px',
                                    margin: '0 auto'
                                }}
                                src={headType === HEAD_LASER ? '/resources/images/cnc-laser/working-origin-laser-4.png' : '/resources/images/cnc-laser/working-origin-cnc-4.png'}
                                role="presentation"
                                alt="3 Axis"
                            />
                            <div className="margin-left-16 sm-flex-width sm-flex height-32">
                                <span className="width-88 margin-right-8">{i18n._('Zero zone')}</span>
                                {headType === HEAD_LASER && (
                                    <Select
                                        backspaceRemoves={false}
                                        size="120px"
                                        clearable={false}
                                        options={[
                                            {
                                                label: 'top',
                                                value: 'top'
                                            }]}
                                        isGroup={false}
                                        value="top"
                                        disabled
                                    />
                                )}
                                {headType !== HEAD_LASER && (
                                    <Select
                                        backspaceRemoves={false}
                                        size="120px"
                                        clearable={false}
                                        options={[
                                            {
                                                label: 'center',
                                                value: 'center'
                                            }]}
                                        isGroup={false}
                                        value="center"
                                        disabled
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { headType } = ownProps;
    const { size } = state.machine;
    const { inProgress, useBackground } = state[headType];

    return {
        size,
        inProgress,
        headType,
        useBackground
    };
};

// const mapDispatchToProps = (dispatch, ownProps) => {
//     const { headType } = ownProps;
//
//     return {
//         updateMaterials: (materials) => dispatch(editorActions.updateMaterials(headType, materials)),
//         changeCoordinateMode: (coordinateMode, coordinateSize) => dispatch(editorActions.changeCoordinateMode(headType, coordinateMode, coordinateSize))
//     };
// };

export default connect(mapStateToProps)(JobType);
