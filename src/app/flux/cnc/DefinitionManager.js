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

    async createToolListDefinition(activeToolListDefinition) {
        const res = await api.cncConfigs.createToolListDefinition(activeToolListDefinition);
        return res.body.definition;
    }

    async removeToolListDefinition(activeToolList) {
        const res = await api.cncConfigs.removeToolListDefinition(activeToolList);
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

    async updateToolDefinition(activeToolList) {
        await api.cncConfigs.updateToolDefinition(activeToolList);
    }

    async changeActiveToolListDefinition(definitionId, name) {
        const res = await api.cncConfigs.changeActiveToolListDefinition(definitionId, name);
        return res.body.definition;
    }
}

const definitionManager = new DefinitionManager();

export default definitionManager;
