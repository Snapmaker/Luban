
import * as helpers from '../ParseHelpers';

export default function EntityParser() {}

EntityParser.ForEntityName = 'SOLID';

EntityParser.prototype.parseEntity = function parseEntity(scanner, currentGroup) {
    const entity = { type: currentGroup.value };
    entity.points = [];
    currentGroup = scanner.next();
    while (currentGroup !== 'EOF') {
        if (currentGroup.code === 0) break;

        switch (currentGroup.code) {
            case 10:
                entity.points[0] = helpers.parsePoint(scanner);
                break;
            case 11:
                entity.points[1] = helpers.parsePoint(scanner);
                break;
            case 12:
                entity.points[2] = helpers.parsePoint(scanner);
                break;
            case 13:
                entity.points[3] = helpers.parsePoint(scanner);
                break;
            case 210:
                entity.extrusionDirection = helpers.parsePoint(scanner);
                break;
            default: // check common entity attributes
                helpers.checkCommonEntityProperties(entity, currentGroup);
                break;
        }
        currentGroup = scanner.next();
    }

    return entity;
};
