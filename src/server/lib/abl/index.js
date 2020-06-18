import subdivision from './bed_level_subdivision';
import getOffset from './get_z_offset';

const getOffestCreator = (zValues, gridNum, rect) => {
    const zValuesVirt = subdivision(zValues, gridNum);
    return (targetPoint) => {
        const offset = getOffset(targetPoint, gridNum, rect, zValuesVirt);
        return offset;
    };
};

export default getOffestCreator;
