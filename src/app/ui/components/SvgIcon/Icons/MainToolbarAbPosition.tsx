import React from 'react';

type SvgIconProps = {
  color?: string;
  disabled?: boolean;
  size?: string | number;
};

const MainToolbarAbPosition: React.FC<SvgIconProps> = (props) => {
    const { color, size, disabled, ...otherProps } = props;

    const actualColor = color || (disabled ? '#E7E8E9' : '#676869');

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            disabled={disabled}
            viewBox="0 0 24 24"
            fill={actualColor}
            {...otherProps}
        >

            <path fillRule="evenodd" clipRule="evenodd" d="M18.5 4.5H4.5V18.5H18.5V4.5ZM2 2V21H21V2H2Z" />
            <path d="M8 4C8 6.20914 6.20914 8 4 8C1.79086 8 0 6.20914 0 4C0 1.79086 1.79086 0 4 0C6.20914 0 8 1.79086 8 4Z" />
            <path d="M24 19C24 21.2091 22.2091 23 20 23C17.7909 23 16 21.2091 16 19C16 16.7909 17.7909 15 20 15C22.2091 15 24 16.7909 24 19Z" />
        </svg>
    );
};

export default MainToolbarAbPosition;
