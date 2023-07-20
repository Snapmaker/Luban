import { Row, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback } from 'react';

import i18n from '../../../lib/i18n';
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


const ControlPanel: React.FC = () => {
    const onGoToWorkOrigin = useCallback(() => {
        console.log('Goto Origin');
    }, []);

    const onSetWorkOrigin = useCallback(() => {
        console.log('Set Origin');
    }, []);

    const onRunBoundary = useCallback(() => {
        console.log('Run boundary');
    }, []);

    const onMovement = useCallback(({ x, y }) => {
        if (x === 0 && y === 0) {
            onGoToWorkOrigin();
        }

        console.log('x, y', x, y);
    }, [onGoToWorkOrigin]);

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
                        {i18n._('key-Workspace/Control/MotionButton-Run Boundary')}
                    </Button>
                </div>
            </div>
            {/* Distance */}
            <div className="margin-top-16">
                <div>
                    <span>XY Axis Travel Distance</span>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
