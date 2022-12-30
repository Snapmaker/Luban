import React from 'react';
import { Trans } from 'react-i18next';
import { Tooltip } from 'antd';
import PropTypes from 'prop-types';

import SvgIcon from '../../components/SvgIcon';

declare interface ObjectSvgIconProps {
    model: object;
    iconName: string;
    disabled?: boolean;
}

const ObjectSvgIcon: React.FC<ObjectSvgIconProps> = (props) => {
    const { model, disabled = false, iconName } = props;
    const Icon = (
        <SvgIcon
            type={['static']}
            color={model.needRepair ? '#FFA940' : ''}
            name={model.needRepair ? 'WarningTipsWarningBig' : iconName}
            className="margin-right-4"
            disabled={disabled}
        />
    );
    if (model.needRepair) {
        return (
            <Tooltip
                placement="topLeft"
                title={(
                    <Trans i18nKey="key-PrintingCncLaser/ObjectList-This is a deficient model. Select it and click Repair.">
                        This is a deficient model. Select it and click <b>Repair</b>.
                    </Trans>
                )}
                arrowPointAtCenter
            >
                {Icon}
            </Tooltip>
        );
    } else {
        return Icon;
    }
};

ObjectSvgIcon.propTypes = {
    model: PropTypes.object.isRequired,
    iconName: PropTypes.string.isRequired,
    disabled: PropTypes.bool.isRequired,
};

export default ObjectSvgIcon;
