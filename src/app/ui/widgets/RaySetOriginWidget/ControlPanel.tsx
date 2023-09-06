import { Input, Radio, Row, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';

import i18n from '../../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';
import { Button } from '../../components/Buttons';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

/**
 * Jog Button
 *
 * Note: should be under div.control-panel
 */
interface JogButtonProps {
    text?: string;
    iconName?: string;
    onClick: () => void;
    disabled?: boolean;
}

const JogButton: React.FC<JogButtonProps> = (props) => {
    const {
        text = null,
        iconName = null,
        disabled = false,
        onClick,
    } = props;

    return (
        <button
            type="button"
            className="btn btn-sm jog-btn"
            disabled={disabled}
            onClick={onClick}
        >
            {
                iconName && (
                    <SvgIcon
                        borderRadius={8}
                        name={iconName}
                        color="#222222"
                    />
                )
            }
            {
                !iconName && text
            }
        </button>
    );
};

/**
 * Job View with only XY move.
 */
interface JogViewProps {
    disabled?: boolean;
    onMovement: ({ x, y }) => void;
}

const JogView: React.FC<JogViewProps> = (props) => {
    const { disabled, onMovement } = props;

    return (
        <div>
            <Row>
                <Space direction="horizontal" size={4}>
                    <JogButton
                        iconName="TopLeft"
                        disabled={disabled}
                        onClick={() => onMovement({ x: -1, y: 1 })}
                    />
                    <JogButton
                        text="Y+"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 0, y: 1 })}
                    />
                    <JogButton
                        iconName="TopRight"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 1, y: 1 })}
                    />
                </Space>
            </Row>
            <Row className="margin-top-8">
                <Space direction="horizontal" size={4}>
                    <JogButton
                        text="X-"
                        disabled={disabled}
                        onClick={() => onMovement({ x: -1, y: 0 })}
                    />
                    <JogButton
                        text="H"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 0, y: 0 })}
                    />
                    <JogButton
                        text="X+"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 1, y: 0 })}
                    />
                </Space>
            </Row>
            <Row className="margin-top-8">
                <Space direction="horizontal" size={4}>
                    <JogButton
                        iconName="BottomLeft"
                        disabled={disabled}
                        onClick={() => onMovement({ x: -1, y: -1 })}
                    />
                    <JogButton
                        text="Y-"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 0, y: -1 })}
                    />
                    <JogButton
                        iconName="BottomRight"
                        disabled={disabled}
                        onClick={() => onMovement({ x: 1, y: -1 })}
                    />
                </Space>
            </Row>
        </div>
    );
};

interface ControlPanelProps {
    executeGCode: (code: string) => Promise<void>;
    runBoundary: () => Promise<void>;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const { runBoundary, executeGCode } = props;

    // Distance
    const distanceOptions = [10, 1, 0.1, 0.05];
    const [standardDistance, setStandardDistance] = useState(10);
    const [customDistance, setCustomDistance] = useState(0);

    const onChangeCustomDistance = useCallback((event) => {
        const value = Number(event.target.value);
        const validValue = Math.min(1000, Math.max(0, value));
        setCustomDistance(validValue);
    }, []);
    const onIncreaseCustomDistance = useCallback(() => {
        const value = Math.min(1000, customDistance + 1);
        setCustomDistance(value);
    }, [customDistance]);
    const onDecreaseCustomDistance = useCallback(() => {
        const value = Math.max(0, customDistance - 1);
        setCustomDistance(value);
    }, [customDistance]);

    // Work Origin
    const onGoToWorkOrigin = useCallback(() => {
        executeGCode('G0 X0 Y0');
    }, [executeGCode]);

    const onSetWorkOrigin = useCallback(() => {
        executeGCode('G92 X0 Y0');
    }, [executeGCode]);

    const onRunBoundary = useCallback(() => {
        runBoundary();
    }, [runBoundary]);

    const onMovement = useCallback(({ x, y }) => {
        if (x === 0 && y === 0) {
            executeGCode('G1 X0 Y0 F6000');
        } else {
            const distance = standardDistance !== -1 ? standardDistance : customDistance;
            const code = `G1 X${x * distance} Y${y * distance} F6000`;
            executeGCode(['G91', code, 'G90'].join('\n'));
        }
    }, [executeGCode, standardDistance, customDistance]);

    return (
        <div className={styles['control-panel']}>
            {/* Axes Move */}
            <div
                className={classNames(
                    'margin-left-8 margin-right-8',
                    'sm-flex sm-flex-direction-r',
                )}
            >
                <JogView
                    onMovement={onMovement}
                />
                <div className="margin-left-32 sm-flex-width">
                    <Button
                        type="primary"
                        onClick={onGoToWorkOrigin}
                    >
                        {i18n._('key-Workspace/Control/MotionButton-Go To Work Origin')}
                    </Button>
                    <Button
                        type="primary"
                        className="margin-top-8"
                        onClick={onSetWorkOrigin}
                    >
                        {i18n._('key-Workspace/Control/MotionButton-Set Work Origin')}
                    </Button>
                    <Button
                        type="primary"
                        priority="level-two"
                        className="margin-top-8"
                        onClick={onRunBoundary}
                    >
                        {i18n._('Run Boundary')}
                    </Button>
                </div>
            </div>
            {/* Distance */}
            <div className="margin-top-16">
                <div>
                    <span>XY Axis Travel Distance</span>

                </div>
                <div>
                    <Radio.Group
                        size="small"
                        defaultValue={standardDistance}
                        onChange={(e) => setStandardDistance(e.target.value)}
                    >
                        {
                            distanceOptions.map(option => (
                                <Radio.Button
                                    key={option}
                                    value={option}
                                >
                                    {option}
                                </Radio.Button>
                            ))
                        }
                        {/* -1 value to use custom value */}
                        <Radio.Button key="custom" value={-1}>
                            <i className="fa fa-adjust" />
                        </Radio.Button>
                    </Radio.Group>
                </div>
                {
                    standardDistance === -1 && (
                        <div className="margin-top-8">
                            <Input.Group compat size="small">
                                <Space size={4}>
                                    <Input
                                        type="number"
                                        addonBefore={(<span>{i18n._('key-Workspace/Custom Step')}</span>)}
                                        title={i18n._('key-Workspace/Control/JogDistance-Custom distance for every move')}
                                        min={0}
                                        max={1000}
                                        step={1}
                                        value={customDistance}
                                        onChange={onChangeCustomDistance}
                                    />
                                    <RepeatButton
                                        size="small"
                                        title={i18n._('key-Workspace/Control/JogDistance-Increase custom distance by one unit')}
                                        onClick={onIncreaseCustomDistance}
                                    >
                                        <i className="fa fa-plus" />
                                    </RepeatButton>
                                    <RepeatButton
                                        size="small"
                                        title={i18n._('key-Workspace/Control/JogDistance-Decrease custom distance by one unit')}
                                        onClick={onDecreaseCustomDistance}
                                    >
                                        <i className="fa fa-minus" />
                                    </RepeatButton>
                                </Space>
                            </Input.Group>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

export default ControlPanel;
