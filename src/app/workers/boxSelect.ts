import { getOverlapSize, isInside } from 'overlap-area';
import { Observable } from 'rxjs';

type TBbox = {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
    vertexPoints?: Array<[number, number]>;
};

type SizeNumber = {
    x: number;
    y: number;
};

type BoxSelectData = {
    bbox: TBbox;
    modelsBbox: TBbox[];
    onlyContainSelect: boolean;
    size: SizeNumber;
};

const boxSelect = (data: BoxSelectData) => {
    return new Observable((observer) => {
        const { bbox, modelsBbox, onlyContainSelect, size } = data;
        bbox.x -= size.x;
        bbox.y = size.y - bbox.y;
        const selectBoxPoints = [
            [bbox.x, bbox.y],
            [bbox.x, bbox.y - bbox.height],
            [bbox.x + bbox.width, bbox.y - bbox.height],
            [bbox.x + bbox.width, bbox.y],
        ];

        const selectedIndex = [];
        modelsBbox
            .map((model, index) => {
                return { ...model, index };
            })
            .sort((a, b) => {
                return b.width + b.height - a.width - a.height;
            })
            .forEach(({ vertexPoints, index, visible }) => {
                if (!visible) {
                    return;
                }
                if (onlyContainSelect) {
                    const isContain = vertexPoints.every((point) => {
                        return isInside(point, selectBoxPoints);
                    });
                    if (isContain) {
                        selectedIndex.push(index);
                    }
                } else {
                    const isIntersect = vertexPoints.length === 2
                        ? vertexPoints.some((point) => {
                            return isInside(point, selectBoxPoints);
                        })
                        : getOverlapSize(selectBoxPoints, vertexPoints);
                    if (isIntersect) {
                        selectedIndex.push(index);
                    }
                }
            });

        observer.next(selectedIndex);
        observer.complete();
    });
};

export default boxSelect;
