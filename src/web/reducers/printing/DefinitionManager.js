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

    // Calculate hidden settings
    calculateDependencies(definition, settings) {
        if (settings.infill_sparse_density) {
            const infillLineWidth = definition.settings.infill_line_width.default_value; // 0.4
            const infillSparseDensity = settings.infill_sparse_density.default_value;

            const infillLineDistance = (infillSparseDensity < 1) ? 0 : (infillLineWidth * 100) / infillSparseDensity * 2;

            definition.settings.infill_line_distance.default_value = infillLineDistance;
            settings.infill_line_distance = { default_value: infillLineDistance };
        }

        if (settings.layer_height) {
            const layerHeight = settings.layer_height.default_value;

            // "1 if magic_spiralize else max(1, round((wall_thickness - wall_line_width_0) / wall_line_width_x) + 1) if wall_thickness != 0 else 0"
            const wallThickness = definition.settings.wall_thickness.default_value;
            const wallLineCount = Math.ceil(wallThickness / layerHeight);
            definition.settings.wall_line_count.default_value = wallLineCount;
            settings.wall_line_count = { default_value: wallLineCount };

            // "0 if infill_sparse_density == 100 else math.ceil(round(top_thickness / resolveOrValue('layer_height'), 4))"
            const topThickness = definition.settings.top_thickness.default_value;
            const topLayers = Math.ceil(topThickness / layerHeight);
            definition.settings.top_layers.default_value = topLayers;
            settings.top_layers = { default_value: topLayers };

            // "999999 if infill_sparse_density == 100 else math.ceil(round(bottom_thickness / resolveOrValue('layer_height'), 4))"
            const bottomThickness = definition.settings.bottom_thickness.default_value;
            const bottomLayers = Math.ceil(bottomThickness / layerHeight);
            definition.settings.bottom_layers.default_value = bottomLayers;
            settings.bottom_layers = { default_value: bottomLayers };
        }

        return settings;
    }
}

const definitionManager = new DefinitionManager();

export default definitionManager;
