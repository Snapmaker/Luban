import React from 'react';
import { useSelector } from 'react-redux';
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

function JobType({ headType, jobTypeState, setJobTypeState }) {
    const { size } = useSelector(state => state.machine);
    const { inProgress, useBackground } = useSelector(state => state[headType]);

    const coordinateModeList = [
        {
            label: i18n._(COORDINATE_MODE_CENTER.label),
            value: COORDINATE_MODE_CENTER.value,
            mode: COORDINATE_MODE_CENTER
        },
        {
            label: i18n._(COORDINATE_MODE_BOTTOM_LEFT.label),
            value: COORDINATE_MODE_BOTTOM_LEFT.value,
            mode: COORDINATE_MODE_BOTTOM_LEFT
        },
        {
            label: i18n._(COORDINATE_MODE_BOTTOM_RIGHT.label),
            value: COORDINATE_MODE_BOTTOM_RIGHT.value,
            mode: COORDINATE_MODE_BOTTOM_RIGHT
        },
        {
            label: i18n._(COORDINATE_MODE_TOP_LEFT.label),
            value: COORDINATE_MODE_TOP_LEFT.value,
            mode: COORDINATE_MODE_TOP_LEFT
        },
        {
            label: i18n._(COORDINATE_MODE_TOP_RIGHT.label),
            value: COORDINATE_MODE_TOP_RIGHT.value,
            mode: COORDINATE_MODE_TOP_RIGHT
        }
    ];

    const actions = {
        changeCoordinateMode: (option) => {
            const newCoordinateMode = coordinateModeList.find(d => d.value === option.value);
            const coordinateSize = jobTypeState.coordinateSize;
            actions.setCoordinateModeAndCoordinateSize(newCoordinateMode.mode, coordinateSize);
        },
        setMaterials: (materials) => {
            materials = {
                ...jobTypeState.materials,
                ...materials
            };
            setJobTypeState({
                ...jobTypeState,
                materials
            });
        },
        setCoordinateMode: (coordinateMode) => {
            setJobTypeState({
                ...jobTypeState,
                coordinateMode
            });
        },
        setCoordinateSize: (coordinateSize) => {
            setJobTypeState({
                ...jobTypeState,
                coordinateSize
            });
        },
        setCoordinateModeAndCoordinateSize: (coordinateMode, coordinateSize) => {
            setJobTypeState({
                ...jobTypeState,
                coordinateMode,
                coordinateSize
            });
        },
        setJobTypeState: (coordinateMode, coordinateSize, materials) => {
            materials = {
                ...jobTypeState.materials,
                ...materials
            };
            setJobTypeState({
                ...jobTypeState,
                coordinateMode,
                coordinateSize,
                materials
            });
        }
    };

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
                        {i18n._('key-CncLaser/JobSetup-Work Size')}
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
                                <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Width (X)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(coordinateSize.x, 1)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => {
                                        actions.setCoordinateModeAndCoordinateSize(
                                            coordinateMode, {
                                                x: value,
                                                y: coordinateSize.y
                                            }
                                        );
                                    }}
                                />
                            </div>
                            <div className="sm-flex height-32 position-re margin-top-16">
                                <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Height (Y)')}</span>
                                <Input
                                    suffix="mm"
                                    disabled={inProgress || settingSizeDisabled}
                                    value={toFixed(coordinateSize.y, 1)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => {
                                        actions.setCoordinateModeAndCoordinateSize(
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
                        {i18n._('key-CncLaser/JobSetup-Work Origin')}
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
                            <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                            <Select
                                backspaceRemoves={false}
                                size="120px"
                                clearable={false}
                                options={coordinateModeList}
                                isGroup={false}
                                placeholder={i18n._('key-CncLaser/JobSetup-Choose font')}
                                value={coordinateMode.value ?? COORDINATE_MODE_CENTER.value}
                                onChange={actions.changeCoordinateMode}
                                disabled={inProgress || settingSizeDisabled}
                            />
                        </div>
                    </div>
                </div>
            )}
            {isRotate && (
                <div className="margin-left-50">
                    <div className="margin-bottom-16 font-weight-bold">
                        {i18n._('key-CncLaser/JobSetup-Work Size')}
                    </div>
                    <div className="sm-flex">
                        <img
                            draggable="false"
                            style={{
                                width: '330px',
                                margin: '0'
                            }}
                            src="/resources/images/cnc-laser/working-size-4.png"
                            role="presentation"
                            alt="3 Axis"
                        />
                    </div>
                    <div className="margin-top-16">
                        <div className="sm-flex height-32 position-re">
                            <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Length (L)')}</span>
                            <Input
                                suffix="mm"
                                disabled={inProgress || settingSizeDisabled}
                                value={toFixed(length, 1)}
                                max={size.y}
                                min={10}
                                onChange={(value) => {
                                    actions.setJobTypeState(
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
                            <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Diameter (D)')}</span>
                            <Input
                                suffix="mm"
                                disabled={inProgress || settingSizeDisabled}
                                value={toFixed(diameter, 1)}
                                max={size.x}
                                min={2}
                                onChange={(value) => {
                                    actions.setJobTypeState(
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
                        {i18n._('key-CncLaser/JobSetup-Work Origin')}
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
                            <span className="width-88 margin-right-8">{i18n._('key-CncLaser/JobSetup-Origin Position')}</span>
                            {headType === HEAD_LASER && (
                                <Select
                                    backspaceRemoves={false}
                                    size="120px"
                                    clearable={false}
                                    options={[
                                        {
                                            label: i18n._('key-CncLaser/JobSetup-Top'),
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
                                            label: i18n._('key-CncLaser/JobSetup-Center'),
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
JobType.propTypes = {
    headType: PropTypes.string.isRequired,
    jobTypeState: PropTypes.object.isRequired,
    setJobTypeState: PropTypes.func.isRequired
};

export default JobType;
