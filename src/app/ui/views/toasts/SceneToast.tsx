import React from 'react';
import SvgIcon from '../../components/SvgIcon';

interface SceneToastProps {
    type?: 'info' | 'warning' | 'error';
    iconName?: string;
    text: string;
}

const Type2Icon = {
    'info': 'WarningTipsWarning',
    'warning': 'WarningTipsWarning',
    'error': 'WarningTipsWarning',
};

const Type2Color = {
    'info': '#1890FF',
    'warning': '#FFA940',
    'error': '#FFA940',
};

export const SceneToast: React.FC<SceneToastProps> = (props) => {
    const type = props?.type || 'warning';
    const iconName = props?.iconName || Type2Icon[type] || Type2Icon.warning;
    const iconColor = Type2Color[type] || Type2Color.warning;
    const text = props.text;

    return (
        <div>
            <SvgIcon
                name={iconName}
                type={['static']}
                color={iconColor}
                className="margin-right-4"
            />
            <span className="line-height-24">{text}</span>
        </div>
    );
};

export function makeSceneToast(type: 'info' | 'warning' | 'error', text: string): React.ReactNode {
    return (
        <SceneToast
            type={type}
            text={text}
        />
    );
}
