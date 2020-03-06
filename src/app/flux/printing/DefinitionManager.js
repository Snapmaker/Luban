import api from '../../api';
import { MACHINE_SERIES } from '../../constants';

class DefinitionManager {
    snapmakerDefinition = null;

    activeDefinition = null;

    materialDefinitions = [];

    qualityDefinitions = [];

    series = '';

    async init(series) {
        this.series = series;
        let res;

        if (this.series === MACHINE_SERIES.ORIGINAL.value) {
            res = await api.printingConfigs.getDefinition('snapmaker');
            this.snapmakerDefinition = res.body.definition;
        } else {
            res = await api.printingConfigs.getDefinition('snapmaker2');
            this.snapmakerDefinition = res.body.definition;
        }

        // active definition
        res = await api.printingConfigs.getDefinition('active');
        this.activeDefinition = res.body.definition;

        res = await api.printingConfigs.getMaterialDefinitions();
        this.materialDefinitions = res.body.definitions;

        res = await api.printingConfigs.getQualityDefinitions(series);
        this.qualityDefinitions = res.body.definitions;
    }

    async createDefinition(definition) {
        const res = await api.printingConfigs.createDefinition(definition, this.series);
        return res.body.definition;
    }

    async removeDefinition(definition) {
        await api.printingConfigs.removeDefinition(definition.definitionId, this.series);
    }

    // Update definition
    // Only name & settings are configurable
    async updateDefinition(definition) {
        await api.printingConfigs.updateDefinition(definition.definitionId, definition, this.series);
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
            const wallOutLineWidth = definition.settings.wall_line_width_0.default_value;
            const wallInnerLineWidth = definition.settings.wall_line_width_x.default_value;

            const wallLineCount = wallThickness !== 0 ? Math.max(1, Math.round((wallThickness - wallOutLineWidth) / wallInnerLineWidth) + 1) : 0;
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
        if (settings.speed_print_layer_0) {
            // "skirt_brim_speed = speed_print_layer_0"
            const speedPrintLayer0 = settings.speed_print_layer_0.default_value;
            settings.skirt_brim_speed = { default_value: speedPrintLayer0 };
        }
        if (settings.support_infill_rate) {
            const supportInfillRate = settings.support_infill_rate.default_value;
            const supportLineWidth = definition.settings.support_line_width.default_value;

            // "0 if support_infill_rate == 0 else (support_line_width * 100) / support_infill_rate *
            // (2 if support_pattern == 'grid' else (3 if support_pattern == 'triangles' else 1))"
            const supportPattern = definition.settings.support_pattern.default_value;
            let supportPatternRate = 1;
            if (supportPattern === 'grid') {
                supportPatternRate = 2;
            } else if (supportPattern === 'triangles') {
                supportPatternRate = 3;
            }
            definition.settings.support_line_distance.default_value = supportInfillRate === 0 ? 0
                : supportLineWidth * 100 / supportInfillRate * supportPatternRate;
            definition.settings.support_initial_layer_line_distance.default_value = definition.settings.support_line_distance.default_value;
        }
        // if (settings.support_z_distance) {
        //     const supportZDistance = settings.support_z_distance.default_value;
        //     definition.settings.support_top_distance.default_value = supportZDistance;
        //     definition.settings.support_bottom_distance.default_value = supportZDistance;
        // }

        return settings;
    }

    finalizeActiveDefinition(activeDefinition) {
        const definition = {
            definitionId: 'active_final',
            name: 'Active Profile',
            inherits: 'fdmprinter',
            metadata: {
                machine_extruder_trains: {
                    0: 'snapmaker_extruder_0'
                }
            },
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
            `M104 S${printTempLayer0}`
        ];
        if (machineHeatedBed) {
            gcode.push(`M140 S${bedTempLayer0}`);
        }
        gcode.push('G28 ;home');
        gcode.push('G90 ;absolute positioning');
        gcode.push('G1 X-10 Y-10 F3000');
        gcode.push('G1 Z0 F1800');

        gcode.push(`M109 S${printTempLayer0};Wait for Hotend Temperature`);
        if (machineHeatedBed) {
            gcode.push(`M190 S${bedTempLayer0};Wait for Bed Temperature`);
        }

        gcode.push('G92 E0');
        gcode.push('G1 E20 F200');
        gcode.push('G92 E0');
        gcode.push(';Start GCode end');

        definition.settings.machine_start_gcode = { default_value: gcode.join('\n') };
    }

    addMachineEndGcode(definition) {
        // TODO: use relative to set targetZ(use: current z + 10).
        // It is ok even if targetZ is bigger than 125 because firmware has set limitation
        const y = definition.settings.machine_depth.default_value;
        const z = definition.settings.machine_height.default_value;
        const speedTravel = definition.settings.speed_travel.default_value;

        const gcode = [
            ';End GCode begin',
            'M104 S0 ;extruder heater off',
            'M140 S0 ;heated bed heater off (if you have it)',
            'G90 ;absolute positioning',
            'G92 E0',
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure',
            `G1 Z${z} E-1 F${speedTravel} ;move Z up a bit and retract filament even more`,
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
