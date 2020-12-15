import api from '../../api';

class DefinitionManager {
    activeToolDefinition = null;

    toolDefinitions = [];

    async init() {
        // active definition
        const res = await api.cncConfigs.getToolListDefinition('active');
        this.activeToolDefinition = res.body.definition;

        // res = await api.cncConfigs.getDefinition('mdf', 'snap.flat-end-mill');
        // this.activeToolDefinition = res.body.definition;

        const toolDefinitions = await api.cncConfigs.getAllDefinitions();
        this.toolDefinitions = toolDefinitions.body.definitions;
    }

    async getToolListDefinition(definitionId) {
        const res = await api.cncConfigs.getToolListDefinition(definitionId);
        return res.body.definition;
    }

    async getAllDefinitions() {
        const toolDefinitions = await api.cncConfigs.getAllDefinitions();
        this.toolDefinitions = toolDefinitions.body.definitions;
    }

    async createToolCategoryDefinition(activeToolCategory) {
        const res = await api.cncConfigs.createToolCategoryDefinition(activeToolCategory);
        return res.body.definition;
    }

    async createToolListDefinition(activeToolCategoryDefinition, activeToolListDefinition) {
        const res = await api.cncConfigs.createToolListDefinition(activeToolCategoryDefinition, activeToolListDefinition);
        return res.body.definition;
    }

    async removeToolCategoryDefinition(activeToolCategory) {
        console.log('activeToolCategory', activeToolCategory);
        await api.cncConfigs.removeToolCategoryDefinition(activeToolCategory.category);
    }

    async removeToolListDefinition(activeToolCategory, activeToolList) {
        const res = await api.cncConfigs.removeToolListDefinition(activeToolCategory, activeToolList);
        return res.body.definition;
    }
    // TODO:

    async uploadDefinition(definitionId, tmpPath) {
        const res = await api.printingConfigs.uploadDefinition(definitionId, tmpPath);
        const { err, definition } = res.body;
        if (err) {
            console.error(err);
            return null;
        } else {
            return definition;
        }
    }

    // Update definition
    // Only name & settings are configurable
    async updateDefinition(definition) {
        await api.printingConfigs.updateDefinition(definition.definitionId, definition, this.series);
    }
}

const definitionManager = new DefinitionManager();

export default definitionManager;
