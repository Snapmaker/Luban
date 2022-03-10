import { getOverlapSize, isInside } from 'overlap-area';
import sendMessage from './utils/sendMessage';

type TBbox = {
    x: number,
    y: number,
    width: number,
    height: number,
    vertexPoints?: Array<([number, number])>
}

const boxSelect = (bbox: TBbox, modelsBbox: TBbox[], onlyContainSelect: boolean, size: { x: number, y: number }) => {
    bbox.x -= size.x;
    bbox.y = size.y - bbox.y;
    const selectBoxPoints = [
        [bbox.x, bbox.y],
        [bbox.x, bbox.y - bbox.height],
        [bbox.x + bbox.width, bbox.y - bbox.height],
        [bbox.x + bbox.width, bbox.y]
    ];

    const selectedIndex = [];
    modelsBbox.map((model, index) => {
        return { ...model, index };
    }).sort((a, b) => {
        return b.width + b.height - a.width - a.height;
    }).forEach(({ vertexPoints, width, height, index }) => {
        if (width === 0) { width = 1; }
        if (height === 0) { height = 1; }
        if (onlyContainSelect) {
            const res = vertexPoints.every(point => {
                return isInside(point, selectBoxPoints);
            });
            if (res) {
                selectedIndex.push(index);
            }
        } else {
            const overlapSize = getOverlapSize(selectBoxPoints, vertexPoints);
            if (overlapSize) {
                selectedIndex.push(index);
            }
        }
    });

    sendMessage(selectedIndex);
};

export default boxSelect;
