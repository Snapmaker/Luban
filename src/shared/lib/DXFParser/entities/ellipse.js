
import * as helpers from '../ParseHelpers';

export default function EntityParser() {}

EntityParser.ForEntityName = 'ELLIPSE';

EntityParser.prototype.parseEntity = function parseEntity(scanner, curr) {
    const entity = { type: curr.value };
    curr = scanner.next();
    while (curr !== 'EOF') {
        if (curr.code === 0) break;

        switch (curr.code) {
            case 10:
                entity.center = helpers.parsePoint(scanner);
                break;
            case 11:
                entity.majorAxisEndPoint = helpers.parsePoint(scanner);
                break;
            case 40:
                entity.axisRatio = curr.value;
                break;
            case 41:
                entity.startAngle = curr.value;
                break;
            case 42:
                entity.endAngle = curr.value;
                break;
            case 2:
                entity.name = curr.value;
                break;
            default: // check common entity attributes
                helpers.checkCommonEntityProperties(entity, curr);
                break;
        }

        curr = scanner.next();
    }

    return entity;
};
