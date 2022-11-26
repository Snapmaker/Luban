import React from 'react';
import SvgIcon from '../SvgIcon';

export const ToastWapper = (text1, svgName, color) => (
    <div>
        <SvgIcon
            name={svgName}
            type="static"
            color={color}
            className="margin-right-4"
        />
        <span className="line-height-24">{text1}</span>
    </div>
);
