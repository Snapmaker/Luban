import { getOverlapSize, isInside } from 'overlap-area';
import sendMessage from './utils/sendMessage';

type TBbox = {
    x: number,
    y: number,
    width: number,
    height: number,
    visible: boolean,
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
    }).forEach(({ vertexPoints, index, visible }) => {
        if (!visible) {
            return;
        }
        if (onlyContainSelect) {
            const isContain = vertexPoints.every(point => {
                return isInside(point, selectBoxPoints);
            });
            if (isContain) {
                selectedIndex.push(index);
            }
        } else {
            const isIntersect = vertexPoints.length === 2 ? vertexPoints.some(point => {
                return isInside(point, selectBoxPoints);
            }) : getOverlapSize(selectBoxPoints, vertexPoints);
            if (isIntersect) {
                selectedIndex.push(index);
            }
        }
    });

    sendMessage(selectedIndex);
};

export default boxSelect;
