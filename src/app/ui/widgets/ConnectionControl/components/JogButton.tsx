import React from 'react';

import SvgIcon from '../../../components/SvgIcon';

interface JogButtonProps {
    text?: string;
    iconName?: string;
    onClick: () => void;
    disabled?: boolean;
}

const NORMAL_COLOR = '#222';
const DISABLED_COLOR = '#aaa';

/**
 * Jog Button
 *
 * Note: should be under div.control-panel
 */
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
                        color={disabled ? DISABLED_COLOR : NORMAL_COLOR}
                    />
                )
            }
            {
                !iconName && (
                    <span>{text}</span>
                )
            }
        </button>
    );
};

export default JogButton;
