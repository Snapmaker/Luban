import api from '../../api';

class DefinitionManager {
    activeToolListDefinition = null;

    toolDefinitions = [];

    async init() {
        const toolDefinitions = await api.cncConfigs.getAllDefinitions();
        this.toolDefinitions = toolDefinitions.body.definitions;
        // active definition
        const res = await api.cncConfigs.getToolListDefinition('active');
        this.activeToolListDefinition = res.body.definition;
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

    async removeToolCategoryDefinition(definitionId) {
        await api.cncConfigs.removeToolCategoryDefinition(definitionId);
        return null;
    }

    async removeToolListDefinition(activeToolCategory, activeToolList) {
        const res = await api.cncConfigs.removeToolListDefinition(activeToolCategory, activeToolList);
        return res.body.definition;
    }

    async uploadToolDefinition(uploadName, toolDefinitions) {
        const res = await api.cncConfigs.uploadToolDefinition(uploadName, toolDefinitions);
        const { err, definition } = res.body;
        if (err) {
            console.error(err);
            return null;
        } else {
            return definition;
        }
    }

    async updateToolDefinition(activeToolCategory) {
        await api.cncConfigs.updateToolDefinition(activeToolCategory);
    }

    async changeActiveToolListDefinition(definitionId, toolName) {
        const res = await api.cncConfigs.changeActiveToolListDefinition(definitionId, toolName);
        return res.body.definition;
    }
    // TODO:
    // Update active definition
    // Only definitionId & toolName are configurable
}

const definitionManager = new DefinitionManager();

export default definitionManager;
