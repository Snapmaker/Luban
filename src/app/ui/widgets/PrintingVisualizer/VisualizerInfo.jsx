import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';

import { humanReadableTime } from '../../../lib/time-utils';
import Space from '../../components/Space';


/**
 * display gcode info when "displayedType === 'gcode'"
 * display model bbox info when there is a model selected
 */
const GcodeInfo = () => {
    const printTime = useSelector(state => state?.printing?.printTime, shallowEqual);
    const filamentLength = useSelector(state => state?.printing?.filamentLength, shallowEqual);
    const filamentWeight = useSelector(state => state?.printing?.filamentWeight, shallowEqual);
    function getFilamentDes(index) {
        if (!filamentLength || !filamentWeight || !filamentLength[index] || !filamentWeight[index]) {
            return '';
        }
        return `${filamentLength[index].toFixed(1)} m / ${filamentWeight[index].toFixed(1)} g`;
    }
    const filamentLeftDes = getFilamentDes(0);
    const filamentRightDes = getFilamentDes(1);
    const printTimeDes = humanReadableTime(printTime);
    return (
        <React.Fragment>
            <p>
                <span className="fa fa-clock-o" />
                <Space width={4} />
                {printTimeDes}
            </p>
            <p>
                <span className="fa fa-bullseye" />
                <Space width={4} />
                {filamentLeftDes} (L)
            </p>
            {filamentRightDes && (
                <p>
                    <span className="fa fa-bullseye" />
                    <Space width={4} />
                    {filamentRightDes} (R)
                </p>
            )}
        </React.Fragment>
    );
};

const ModelsInfo = React.memo(({ selectedModelBBoxDes }) => {
    return (
        <React.Fragment>
            <p>
                <span />
                {selectedModelBBoxDes}
            </p>
        </React.Fragment>
    );
});
ModelsInfo.propTypes = {
    selectedModelBBoxDes: PropTypes.string.isRequired
};

function VisualizerInfo() {
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray, shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const selectedModelBBoxDes = useSelector(state => state?.printing?.modelGroup?.getSelectedModelBBoxDes(), shallowEqual);

    if (displayedType === 'gcode') {
        return (
            <GcodeInfo />
        );
    } else if (selectedModelArray.length > 0) {
        return (
            <ModelsInfo selectedModelBBoxDes={selectedModelBBoxDes} />
        );
    } else {
        return null;
    }
}

export default VisualizerInfo;
