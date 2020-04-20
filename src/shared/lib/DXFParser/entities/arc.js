
import * as helpers from '../ParseHelpers';

export default function EntityParser() {}

EntityParser.ForEntityName = 'ARC';

EntityParser.prototype.parseEntity = function parseEntity(scanner, curr) {
    const entity = { type: curr.value };
    curr = scanner.next();
    while (curr !== 'EOF') {
        if (curr.code === 0) break;

        switch (curr.code) {
            case 10: // X coordinate of point
                entity.center = helpers.parsePoint(scanner);
                break;
            case 40: // radius
                entity.radius = curr.value;
                break;
            case 50: // start angle
                entity.startAngle = Math.PI / 180 * curr.value;
                break;
            case 51: // end angle
                entity.endAngle = Math.PI / 180 * curr.value;
                entity.angleLength = entity.endAngle - entity.startAngle; // angleLength is deprecated
                break;
            default: // ignored attribute
                helpers.checkCommonEntityProperties(entity, curr);
                break;
        }
        curr = scanner.next();
    }
    return entity;
};
