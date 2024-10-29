// src/app/ui/components/SvgIcon/Icons/MaterialTest.tsx
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
            version="1.1"
            width={size}
            height={size}
            disabled={disabled}
            fill={actualColor}
            {...otherProps}
            id="图层_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            x="0px"
            y="0px"
            viewBox="0 0 1024 1024"
            style={{ enableBackground: 'new 0 0 1024 1024' }} // Ensure this is an object
            xmlSpace="preserve" // Corrected from xml:space
        >
            <g id="svg_1">
                <path id="svg_2" fill="#CFD0D4" clipRule="evenodd" fillRule="evenodd" d="m135.3,353.9c-8.2,0 -14.8,-6.7 -14.8,-14.8l0,-203.8c0,-8.1 6.7,-14.8 14.8,-14.8l203.8,0c8.2,0 14.8,6.7 14.8,14.8l0,203.8c0,8.2 -6.7,14.8 -14.8,14.8l-203.8,0z" className="st0" />
                <path id="svg_3" fill="#56585B" d="m339.1,125.1c5.6,0 10.3,4.6 10.3,10.3l0,203.8c0,5.6 -4.6,10.3 -10.3,10.3l-203.8,0c-5.6,0 -10.3,-4.6 -10.3,-10.3l0,-203.9c0,-5.6 4.6,-10.3 10.3,-10.3l203.8,0.1m0,-9.1l-203.8,0c-10.7,0 -19.3,8.7 -19.3,19.3l0,203.8c0,10.7 8.7,19.3 19.3,19.3l203.8,0c10.7,0 19.3,-8.7 19.3,-19.3l0,-203.8c0.1,-10.6 -8.6,-19.3 -19.3,-19.3l0,0z" className="st1" />
            </g>
            <g id="svg_4">
                <path id="svg_5" fill="#CFD0D4" clipRule="evenodd" fillRule="evenodd" d="m410.1,353.9c-8.2,0 -14.8,-6.7 -14.8,-14.8l0,-203.8c0,-8.2 6.7,-14.8 14.8,-14.8l203.8,0c8.2,0 14.8,6.7 14.8,14.8l0,203.8c0,8.2 -6.7,14.8 -14.8,14.8l-203.8,0z" className="st0" />
                <path id="svg_6" fill="#56585B" d="m613.9,125.1c5.6,0 10.3,4.6 10.3,10.3l0,203.8c0,5.6 -4.6,10.3 -10.3,10.3l-203.8,0c-5.6,0 -10.3,-4.6 -10.3,-10.3l0,-203.9c0,-5.6 4.6,-10.3 10.3,-10.3l203.8,0.1m0,-9.1l-203.8,0c-10.7,0 -19.3,8.7 -19.3,19.3l0,203.8c0,10.7 8.7,19.3 19.3,19.3l203.8,0c10.7,0 19.3,-8.7 19.3,-19.3l0,-203.8c0.1,-10.6 -8.6,-19.3 -19.3,-19.3l0,0z" className="st1" />
            </g>
            <path id="svg_7" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m684.9,116l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.8c-0.1,-10.6 8.6,-19.3 19.3,-19.3z" className="st2" />
            <g id="svg_8">
                <path id="svg_9" fill="#CFD0D4" clipRule="evenodd" fillRule="evenodd" d="m135.3,628.7c-8.2,0 -14.8,-6.7 -14.8,-14.8l0,-203.8c0,-8.2 6.7,-14.8 14.8,-14.8l203.8,0c8.2,0 14.8,6.7 14.8,14.8l0,203.8c0,8.2 -6.7,14.8 -14.8,14.8l-203.8,0l0,0z" className="st0" />
                <path id="svg_10" fill="#56585B" d="m339.1,399.9c5.6,0 10.3,4.6 10.3,10.3l0,203.8c0,5.6 -4.6,10.3 -10.3,10.3l-203.8,0c-5.6,0 -10.3,-4.6 -10.3,-10.3l0,-203.9c0,-5.6 4.6,-10.3 10.3,-10.3l203.8,0m0,-9.1l-203.8,0c-10.7,0 -19.3,8.7 -19.3,19.3l0,203.8c0,10.7 8.7,19.3 19.3,19.3l203.8,0c10.7,0 19.3,-8.7 19.3,-19.3l0,-203.7c0.1,-10.7 -8.6,-19.4 -19.3,-19.4l0,0z" className="st1" />
            </g>
            <path id="svg_11" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m410.1,390.7l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.7c-0.1,-10.7 8.6,-19.4 19.3,-19.4z" className="st2" />
            <path id="svg_12" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m684.9,390.7l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.7c-0.1,-10.7 8.6,-19.4 19.3,-19.4z" className="st2" />
            <path id="svg_13" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m135.3,665.5l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.7c0,-10.7 8.7,-19.4 19.3,-19.4z" className="st2" />
            <path id="svg_14" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m410.1,665.5l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.7c-0.1,-10.7 8.6,-19.4 19.3,-19.4z" className="st2" />
            <path id="svg_15" fill="#56585B" clipRule="evenodd" fillRule="evenodd" d="m684.9,665.5l203.8,0c10.7,0 19.3,8.7 19.3,19.3l0,203.8c0,10.7 -8.7,19.3 -19.3,19.3l-203.8,0c-10.7,0 -19.3,-8.7 -19.3,-19.3l0,-203.7c-0.1,-10.7 8.6,-19.4 19.3,-19.4z" className="st2" />
        </svg>
    );
};

export default MainToolbarAbPosition;
