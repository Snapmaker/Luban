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

    finalizeActiveDefinition(activeDefinition) {
        const definition = {
            definitionId: 'active_final',
            name: 'Active Profile',
            inherits: 'fdmprinter',
            settings: {},
            ownKeys: []
        };

        Object.keys(activeDefinition.settings).forEach(key => {
            const setting = activeDefinition.settings[key];

            if (setting.from !== 'fdmprinter') {
                definition.settings[key] = {
                    label: setting.label,
                    default_value: setting.default_value
                };
                definition.ownKeys.push(key);
            }
        });

        definition.ownKeys.push('machine_start_gcode');
        definition.ownKeys.push('machine_end_gcode');
        this.addMachineStartGcode(definition);
        this.addMachineEndGcode(definition);

        return definition;
    }

    addMachineStartGcode(definition) {
        const settings = definition.settings;

        const machineHeatedBed = settings.machine_heated_bed.default_value;
        const printTemp = settings.material_print_temperature.default_value;
        const printTempLayer0 = settings.material_print_temperature_layer_0.default_value || printTemp;
        const bedTempLayer0 = settings.material_bed_temperature_layer_0.default_value;

        /**
         * 1.set bed temperature and not wait to reach the target temperature
         * 2.set hotend temperature and wait to reach the target temperature
         * 3.set bed temperature and wait to reach the target temperature
         * bed:
         * M190 wait
         * M140 not wait
         * hotend:
         * M109 wait
         * M104 not wait
         * example:
         * M140 S60
         * M109 S200
         * M190 S60
         */

        const gcode = [
            ';Start GCode begin',
            `M104 S${printTempLayer0} ;Set Hotend Temperature`
        ];
        if (machineHeatedBed) {
            gcode.push(`M140 S${bedTempLayer0} ;Set Bed Temperature`);
        }
        gcode.push('M109 ;Wait for Hotend Temperature');
        if (machineHeatedBed) {
            gcode.push('M190 ;Wait for Bed Temperature');
        }
        gcode.push('G28 ;Home');
        gcode.push('G90 ;absolute positioning');
        gcode.push('G1 X-4 Y-4');
        gcode.push('G1 Z0 F3000');
        gcode.push('G92 E0');
        gcode.push('G1 F200 E20');
        gcode.push('G92 E0');
        gcode.push(';Start GCode end');

        definition.settings.machine_start_gcode = { default_value: gcode.join('\n') };
    }

    addMachineEndGcode(definition) {
        // TODO: use relative to set targetZ(use: current z + 10).
        // It is ok even if targetZ is bigger than 125 because firmware has set limitation
        const y = definition.settings.machine_depth.default_value;
        const z = definition.settings.machine_height.default_value;

        const gcode = [
            ';End GCode begin',
            'M104 S0 ;extruder heater off',
            'M140 S0 ;heated bed heater off (if you have it)',
            'G90 ;absolute positioning',
            'G92 E0',
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure',
            `G1 Z${z} E-1 F{speed_travel} ;move Z up a bit and retract filament even more`,
            `G1 X${0} F3000 ;move X to min endstops, so the head is out of the way`,
            `G1 Y${y} F3000 ;so the head is out of the way and Plate is moved forward`,
            'M84 ;steppers off',
            ';End GCode end'
        ];

        definition.settings.machine_end_gcode = { default_value: gcode.join('\n') };
    }
}

const definitionManager = new DefinitionManager();

export default definitionManager;
