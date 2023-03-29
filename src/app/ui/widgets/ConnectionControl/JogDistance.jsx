import { Input, Radio, Space } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { includes } from 'lodash';

import i18n from '../../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';
import { DISTANCE_MAX, DISTANCE_MIN, DISTANCE_STEP } from './constants';

const JogDistance = (props) => {
    const { state, actions, workPosition } = props;
    const { canClick, selectedDistance, selectedAngle, customDistance, customAngle } = state;

    let distance = String(selectedDistance); // force convert to string
    let angle = String(selectedAngle);

    const distanceOptions = [!workPosition.isFourAxis ? '10' : '5', '1', '0.1', '0.05'];
    if (!includes(distanceOptions, distance)) {
        distance = '';
    }

    const angleOptions = ['5', '1', '0.2'];
    if (!includes(angleOptions, angle)) {
        angle = '';
    }

    return (
        <div>
            <div>
                <p className="margin-vertical-8">{i18n._('key-Workspace/Control/JogDistance-XYZ Axis Travel Distance')}</p>
                <Space direction="vertical" size={8}>
                    <Radio.Group
                        size="small"
                        defaultValue={distance}
                        onChange={(e) => actions.selectDistance(e.target.value)}
                    >
                        {
                            distanceOptions.map(option => (
                                <Radio.Button key={option} value={option} disabled={!canClick}>{option}</Radio.Button>
                            ))
                        }
                        {/* empty value to use custom value */}
                        <Radio.Button key="custom" value="" disabled={!canClick}><i className="fa fa-adjust" /></Radio.Button>
                    </Radio.Group>
                    {
                        distance === '' && (
                            <Input.Group compat size="small">
                                <Space size={4}>
                                    <Input
                                        type="number"
                                        addonBefore={(<span>{i18n._('key-Workspace/Custom Step')}</span>)}
                                        title={i18n._('key-Workspace/Control/JogDistance-Custom distance for every move')}
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
                                        size="small"
                                        title={i18n._('key-Workspace/Control/JogDistance-Increase custom distance by one unit')}
                                        onClick={actions.increaseCustomDistance}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-plus" />
                                    </RepeatButton>
                                    <RepeatButton
                                        size="small"
                                        title={i18n._('key-Workspace/Control/JogDistance-Decrease custom distance by one unit')}
                                        onClick={actions.decreaseCustomDistance}
                                        disabled={!canClick}
                                    >
                                        <i className="fa fa-minus" />
                                    </RepeatButton>
                                </Space>
                            </Input.Group>
                        )
                    }
                </Space>
            </div>
            {workPosition.isFourAxis && (
                <div>
                    <p className="margin-vertical-8">{i18n._('key-Workspace/Control/JogDistance-B Axis Rotation Angle')}</p>
                    <Space direction="vertical" size={8}>
                        <Radio.Group
                            size="small"
                            defaultValue={angle}
                            onChange={(e) => actions.selectAngle(e.target.value)}
                        >
                            <Radio.Button key="5" value="5" disabled={!canClick}>5</Radio.Button>
                            <Radio.Button key="1" value="1" disabled={!canClick}>1</Radio.Button>
                            <Radio.Button key="0.2" value="0.2" disabled={!canClick}>0.2</Radio.Button>
                            {/* empty value for custom */}
                            <Radio.Button key="custom" value="" disabled={!canClick}><i className="fa fa-adjust" /></Radio.Button>
                        </Radio.Group>
                        {
                            angle === '' && (
                                <Input.Group compat size="small">
                                    <Space size={4}>
                                        <Input
                                            type="number"
                                            addonBefore={(<span>{i18n._('key-Workspace/Custom Step')}</span>)}
                                            style={{ borderColor: '#6c757d' }}
                                            className="form-control"
                                            title={i18n._('key-Workspace/Control/JogDistance-Custom angle for every move operation')}
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
                                            size="small"
                                            title={i18n._('key-Workspace/Control/JogDistance-Increase custom angle by one unit')}
                                            onClick={actions.increaseCustomAngle}
                                            disabled={!canClick}
                                        >
                                            <i className="fa fa-plus" />
                                        </RepeatButton>
                                        <RepeatButton
                                            size="small"
                                            title={i18n._('key-Workspace/Control/JogDistance-Decrease custom distance by one unit')}
                                            onClick={actions.decreaseCustomAngle}
                                            disabled={!canClick}
                                        >
                                            <i className="fa fa-minus" />
                                        </RepeatButton>
                                    </Space>
                                </Input.Group>
                            )
                        }
                    </Space>
                </div>
            )}
        </div>
    );
};

JogDistance.propTypes = {
    state: PropTypes.object,
    workPosition: PropTypes.object,
    actions: PropTypes.object
};

export default JogDistance;
