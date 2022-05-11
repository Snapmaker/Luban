import React from 'react';
import SvgIcon from '../../../components/SvgIcon';
import i18n from '../../../../lib/i18n';


const itemWrapper = (props) => {
    return (
        <div className="margin-top-16">
            <div className="border-bottom-normal padding-bottom-4">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._(props.title)}</span>
            </div>
            <div className="display-block margin-left-8 height-32">
                {props.children}
            </div>
        </div>
    );
};

export default itemWrapper;
