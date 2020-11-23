import _ from 'lodash';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP
} from './constants';
import styles from './index.styl';

const JogDistance = (props) => {
    const { state, actions } = props;
    const { canClick, units, selectedDistance, selectedAngle, customDistance, customAngle, workPosition } = state;
    // console.log('JogDistance', selectedAngle, customAngle);
    const distance = String(selectedDistance); // force convert to string
    const isCustomDistanceSelected = !(_.includes(['10', '1', '0.1', '0.05'], distance));
    const angle = String(selectedAngle);
    const isCustomAngleSelected = !(_.includes(['5', '1', '0.5'], angle));
    const distanceClasses = {
        '10': classNames(
            'btn',
            'col-3',
            {
                'btn-secondary': distance === '10',
                'btn-outline-secondary': distance !== '10'
            }
        ),
        '1': classNames(
            'btn',
            'col-3',
            {
                'btn-secondary': distance === '1',
                'btn-outline-secondary': distance !== '1'
            }
        ),
        '0.1': classNames(
            'btn',
            'col-3',
            {
                'btn-secondary': distance === '0.1',
                'btn-outline-secondary': distance !== '0.1'
            }
        ),
        '0.05': classNames(
            'btn',
            'col-3',
            {
                'btn-secondary': distance === '0.05',
                'btn-outline-secondary': distance !== '0.05'
            }
        ),
        'custom': classNames(
            'btn',
            {
                'btn-secondary': isCustomDistanceSelected,
                'btn-outline-secondary': !isCustomDistanceSelected
            }
        )
    };
    const angleClasses = {
        '5': classNames(
            'btn',
            'col-4',
            {
                'btn-secondary': angle === '5',
                'btn-outline-secondary': angle !== '5'
            }
        ),
        '1': classNames(
            'btn',
            'col-4',
            {
                'btn-secondary': angle === '1',
                'btn-outline-secondary': angle !== '1'
            }
        ),
        '0.5': classNames(
            'btn',
            'col-4',
            {
                'btn-secondary': angle === '0.5',
                'btn-outline-secondary': angle !== '0.5'
            }
        ),
        'custom': classNames(
            'btn',
            {
                'btn-secondary': isCustomAngleSelected,
                'btn-outline-secondary': !isCustomAngleSelected
            }
        )
    };
    return (
        <div>
            <div className={styles['jog-distance-control']}>
                <p>{i18n._('XYZ Axis Travel Distance')}</p>
                <div className="row no-gutters">
                    <div className="col-12">
                        <div className="input-group no-gutters">
                            <div className="col-6">
                                <button
                                    type="button"
                                    className={distanceClasses['10']}
                                    title={`10 ${units}`}
                                    onClick={() => actions.selectDistance('10')}
                                    disabled={!canClick}
                                    style={{ height: '31.25px' }}
                                >
                                    10
                                </button>
                                <button
                                    type="button"
                                    className={distanceClasses['1']}
                                    title={`1 ${units}`}
                                    onClick={() => actions.selectDistance('1')}
                                    disabled={!canClick}
                                    style={{ height: '31.25px' }}
                                >
                                    1
                                </button>
                                <button
                                    type="button"
                                    className={distanceClasses['0.1']}
                                    title={`0.1 ${units}`}
                                    onClick={() => actions.selectDistance('0.1')}
                                    disabled={!canClick}
                                    style={{ height: '31.25px' }}
                                >
                                    0.1
                                </button>
                                <button
                                    type="button"
                                    className={distanceClasses['0.05']}
                                    title={`0.05 ${units}`}
                                    onClick={() => actions.selectDistance('0.05')}
                                    disabled={!canClick}
                                    style={{ borderRadius: '0', height: '31.25px' }}
                                >
                                    0.05
                                </button>
                            </div>
                            <button
                                type="button"
                                className={distanceClasses.custom}
                                title={i18n._('User Defined')}
                                onClick={() => actions.selectDistance()}
                                disabled={!canClick}
                            >
                                <i className="fa fa-adjust" />
                            </button>
                            <input
                                type="number"
                                className="form-control"
                                title={i18n._('Custom distance for every move operation')}
                                min={DISTANCE_MIN}
                                max={DISTANCE_MAX}
                                step={DISTANCE_STEP}
                                value={customDistance}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    actions.changeCustomDistance(value);
                                }}
                                disabled={!canClick}
                            />
                            <RepeatButton
                                className="btn btn-outline-secondary"
                                title={i18n._('Increase custom distance by one unit')}
                                onClick={actions.increaseCustomDistance}
                                disabled={!canClick}
                            >
                                <i className="fa fa-plus" />
                            </RepeatButton>
                            <RepeatButton
                                className="btn btn-outline-secondary"
                                title={i18n._('Decrease custom distance by one unit')}
                                onClick={actions.decreaseCustomDistance}
                                disabled={!canClick}
                            >
                                <i className="fa fa-minus" />
                            </RepeatButton>
                        </div>
                    </div>
                </div>
            </div>
            {workPosition.isFourAxis && (
                <div className={styles['jog-distance-control']}>
                    <p>{i18n._('B Axis Angle of Rotation')}</p>
                    <div className="row no-gutters">
                        <div className="col-12">
                            <div className="input-group no-gutters">
                                <div className="col-6">
                                    <button
                                        type="button"
                                        className={angleClasses['5']}
                                        title={`10 ${units}`}
                                        onClick={() => actions.selectAngle('5')}
                                        disabled={!canClick}
                                    >
                                        5
                                    </button>
                                    <button
                                        type="button"
                                        className={angleClasses['1']}
                                        title={`1 ${units}`}
                                        onClick={() => actions.selectAngle('1')}
                                        disabled={!canClick}
                                    >
                                        1
                                    </button>
                                    <button
                                        type="button"
                                        className={angleClasses['0.5']}
                                        title={`0.1 ${units}`}
                                        onClick={() => actions.selectAngle('0.5')}
                                        disabled={!canClick}
                                    >
                                        0.5
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className={angleClasses.custom}
                                    title={i18n._('User Defined')}
                                    onClick={() => actions.selectAngle()}
                                    disabled={!canClick}
                                >
                                    <i className="fa fa-adjust" />
                                </button>
                                <input
                                    type="number"
                                    className="form-control"
                                    title={i18n._('Custom angle for every move operation')}
                                    min={DISTANCE_MIN}
                                    max={DISTANCE_MAX}
                                    step={DISTANCE_STEP}
                                    value={customAngle}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        actions.changeCustomAngle(value);
                                    }}
                                    disabled={!canClick}
                                />
                                <RepeatButton
                                    className="btn btn-outline-secondary"
                                    title={i18n._('Increase custom angle by one unit')}
                                    onClick={actions.increaseCustomAngle}
                                    disabled={!canClick}
                                >
                                    <i className="fa fa-plus" />
                                </RepeatButton>
                                <RepeatButton
                                    className="btn btn-outline-secondary"
                                    title={i18n._('Decrease custom distance by one unit')}
                                    onClick={actions.decreaseCustomAngle}
                                    disabled={!canClick}
                                >
                                    <i className="fa fa-minus" />
                                </RepeatButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

JogDistance.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default JogDistance;
