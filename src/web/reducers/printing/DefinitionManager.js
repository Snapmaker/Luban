import api from '../../api';

class DefinitionManager {
    snapmakerDefinition = null;
    activeDefinition = null;
    materialDefinitions = [];
    qualityDefinitions = [];

    async init() {
        let res;

        res = await api.printingConfigs.getDefinition('snapmaker');
        this.snapmakerDefinition = res.body.definition;

        // active definition
        res = await api.printingConfigs.getDefinition('active');
        this.activeDefinition = res.body.definition;

        // material definitions
        res = await api.printingConfigs.getDefinitionsByType('material');
        this.materialDefinitions = res.body.definitions;

        res = await api.printingConfigs.getDefinitionsByType('quality');
        this.qualityDefinitions = res.body.definitions;
    }

    async createDefinition(definition) {
        const res = await api.printingConfigs.createDefinition(definition);
        return res.body.definition;
    }

    async removeDefinition(definition) {
        await api.printingConfigs.removeDefinition(definition.definitionId);
    }

    // Update definition
    // Only name & settings are configurable
    async updateDefinition(definition) {
        await api.printingConfigs.updateDefinition(definition.definitionId, definition);
    }
}

const definitionManager = new DefinitionManager();

export default definitionManager;
