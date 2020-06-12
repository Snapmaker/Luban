import subdivision from './bed_level_subdivision';
import getOffset from './get_z_offset';

const getOffestCreator = (zValues, gridNum, rect) => {
    const zValuesVirt = subdivision(zValues, gridNum);
    // console.log(zValuesVirt);
    return (targetPoint) => {
        const offset = getOffset(targetPoint, 3, rect, zValuesVirt);
        // console.log(zValues, gridNum, rect, zValuesVirt, targetPoint, offset);
        return offset;
    };
};

export default getOffestCreator;
