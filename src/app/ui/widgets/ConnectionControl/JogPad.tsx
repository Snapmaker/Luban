import { Row, Space } from 'antd';
import React from 'react';

import JogButton from './components/JogButton';
import styles from './styles.styl';


interface MoveOptions {
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
}

interface JogViewProps {
    // whether enable B axis control
    enableBAxis?: boolean;

    // jog buttons are disabled
    disabled?: boolean;

    relativeMove: (moveOptions: MoveOptions) => void;
    absoluteMove: (moveOptions: MoveOptions) => void;
}

const JogPad: React.FC<JogViewProps> = (props) => {
    const {
        disabled = false,
        enableBAxis = false,
        relativeMove,
        absoluteMove,
    } = props;

    return (
        <div className={styles['jog-pad']}>
            <Row className="margin-bottom-8">
                <Space direction="horizontal" size={4}>
                    <JogButton
                        iconName="TopLeft"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: -1, Y: 1 })}
                    />
                    <JogButton
                        text="Y+"
                        disabled={disabled}
                        onClick={() => relativeMove({ Y: 1 })}
                    />
                    <JogButton
                        iconName="TopRight"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: 1, Y: 1 })}
                    />
                    <JogButton
                        text="Z+"
                        disabled={disabled}
                        onClick={() => relativeMove({ Z: 1 })}
                    />
                    {
                        enableBAxis && (
                            <JogButton
                                text="B+"
                                disabled={disabled}
                                onClick={() => relativeMove({ B: 1 })}
                            />
                        )
                    }
                </Space>
            </Row>
            <Row className="margin-bottom-8">
                <Space direction="horizontal" size={4}>
                    <JogButton
                        text="X-"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: -1 })}
                    />
                    <JogButton
                        text="X/Y"
                        disabled={disabled}
                        onClick={() => absoluteMove({ X: 0, Y: 0 })}
                    />
                    <JogButton
                        text="X+"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: 1 })}
                    />
                    <JogButton
                        text="Z"
                        disabled={disabled}
                        onClick={() => absoluteMove({ Z: 0 })}
                    />
                    {
                        enableBAxis && (
                            <JogButton
                                text="B"
                                disabled={disabled}
                                onClick={() => absoluteMove({ B: 0 })}
                            />
                        )
                    }
                </Space>
            </Row>
            <Row className="margin-bottom-8">
                <Space direction="horizontal" size={4}>
                    <JogButton
                        iconName="BottomLeft"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: -1, Y: -1 })}
                    />
                    <JogButton
                        text="Y-"
                        disabled={disabled}
                        onClick={() => relativeMove({ Y: -1 })}
                    />
                    <JogButton
                        iconName="BottomRight"
                        disabled={disabled}
                        onClick={() => relativeMove({ X: 1, Y: -1 })}
                    />
                    <JogButton
                        text="Z-"
                        disabled={disabled}
                        onClick={() => relativeMove({ Z: -1 })}
                    />
                    {
                        enableBAxis && (
                            <JogButton
                                text="B-"
                                disabled={disabled}
                                onClick={() => relativeMove({ B: -1 })}
                            />
                        )
                    }
                </Space>
            </Row>
        </div>
    );
};


export default JogPad;
