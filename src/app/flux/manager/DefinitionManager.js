import api from '../../api';
import i18n from '../../lib/i18n';
import { HEAD_CNC } from '../../constants';

class DefinitionManager {
    headType = HEAD_CNC;

    activeDefinition = null;

    defaultDefinitions = [];

    configPathname = '';

    // series = '';

    async init(headType, configPathname) {
        // if (
        //     seriesWithToolhead.series === MACHINE_SERIES.ORIGINAL_LZ.value
        // //    || series === MACHINE_SERIES.CUSTOM.value
        // ) {
        //     this.seriesWithToolhead = seriesWithToolhead.seriesWithToolhead;
        // } else {
        //     this.seriesWithToolhead = series;
        // }
        this.configPathname = configPathname;
        this.headType = headType;
        let res;
        // TODO useless
        // let definitionId = 'snapmaker2';
        // if (
        //     this.series === MACHINE_SERIES.ORIGINAL.value
        //     || this.series === MACHINE_SERIES.ORIGINAL_LZ.value
        //     || this.series === MACHINE_SERIES.CUSTOM.value
        // ) {
        //     definitionId = 'snapmaker';
        // } else {
        //     definitionId = 'snapmaker2';
        // }
        //
        // res = await api.profileDefinitions.getDefinition(headType, definitionId, this.series);
        // this.snapmakerDefinition = res.body.definition;
        // End TODO useless

        // active definition
        res = await this.getDefinition('active', false);
        this.activeDefinition = res;
        res = await api.profileDefinitions.getDefaultDefinitions(this.headType, this.configPathname);
        // res = await api.profileDefinitions.getConfigDefinitions(this.headType, this.configPathname);
        this.defaultDefinitions = res.body.definitions.map(item => {
            item.isDefault = true;
            return item;
        });
    }

    /**
     * Get raw definition file (for download).
     */
    async getRawDefinition(definitionId) {
        const res = await api.profileDefinitions.getRawDefinition(this.headType, definitionId, this.configPathname);
        return res.body;
    }

    async getDefinition(definitionId, isInsideCategory = true) {
        let res = {};
        if (isInsideCategory) {
            res = await api.profileDefinitions.getDefinition(this.headType, definitionId, this.configPathname);
        } else {
            res = await api.profileDefinitions.getDefinition(this.headType, definitionId);
        }
        return res.body.definition;
    }

    async getConfigDefinitions() {
        const res = await api.profileDefinitions.getConfigDefinitions(this.headType, this.configPathname);
        const definitions = await this.markDefaultDefinitions(res.body.definitions);
        return definitions;
    }

    async getDefinitionsByPrefixName(prefix) {
        const res = await api.profileDefinitions.getDefinitionsByPrefixName(this.headType, prefix, this.configPathname);
        const definitions = await this.markDefaultDefinitions(res.body.definitions);
        return definitions;
    }


    async createDefinition(definition) {
        const res = await api.profileDefinitions.createDefinition(this.headType, definition, this.configPathname);
        return res.body.definition;
    }

    async removeDefinition(definition) {
        await api.profileDefinitions.removeDefinition(this.headType, definition.definitionId, this.configPathname);
    }

    async uploadDefinition(definitionId, uploadName) {
        const res = await api.profileDefinitions.uploadDefinition(this.headType, definitionId, uploadName, this.configPathname);
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
        await api.profileDefinitions.updateDefinition(this.headType, definition.definitionId, definition, this.configPathname);
    }

    async markDefaultDefinitions(remoteDefinitions) {
        if (!this.defaultDefinitions) {
            await this.init();
        }
        const defaultDefinitionMap = {};
        this.defaultDefinitions.forEach(item => {
            defaultDefinitionMap[item.definitionId] = true;
        });
        remoteDefinitions.forEach(item => {
            if (defaultDefinitionMap[item.definitionId]) {
                item.isDefault = true;
                item.name = (item.i18nName ? i18n._(item.i18nName) : item.name);
                item.category = (item.i18nCategory ? i18n._(item.i18nCategory) : item.category);
            }
        });
        return remoteDefinitions;
    }

    // Start Notice: only used for printing config
    // Calculate hidden settings
    calculateDependencies(definition, settings, hasSupportModel) {
        if (settings.infill_sparse_density) {
            const infillLineWidth = definition.settings.infill_line_width.default_value; // 0.4
            const infillSparseDensity = settings.infill_sparse_density.default_value;

            const infillLineDistance = (infillSparseDensity < 1) ? 0 : (infillLineWidth * 100) / infillSparseDensity * 2;

            definition.settings.infill_line_distance.default_value = infillLineDistance;
            settings.infill_line_distance = { default_value: infillLineDistance };

            if (settings.infill_sparse_density.default_value === 100) {
                settings.top_layers = { default_value: 0 };
                settings.bottom_layers = { default_value: 999999 };
            }
        }

        if (settings.layer_height) {
            const layerHeight = settings.layer_height.default_value;

            // "1 if magic_spiralize else max(1, round((wall_thickness - wall_line_width_0) / wall_line_width_x) + 1) if wall_thickness != 0 else 0"
            const wallThickness = definition.settings.wall_thickness.default_value;
            const wallOutLineWidth = definition.settings.wall_line_width_0.default_value;
            const wallInnerLineWidth = definition.settings.wall_line_width_x.default_value;
            const infillSparseDensity = definition.settings.infill_sparse_density.default_value;

            const wallLineCount = wallThickness !== 0 ? Math.max(1, Math.round((wallThickness - wallOutLineWidth) / wallInnerLineWidth) + 1) : 0;
            definition.settings.wall_line_count.default_value = wallLineCount;
            settings.wall_line_count = { default_value: wallLineCount };

            // "0 if infill_sparse_density == 100 else math.ceil(round(top_thickness / resolveOrValue('layer_height'), 4))"
            const topThickness = definition.settings.top_thickness.default_value;
            const topLayers = infillSparseDensity === 100 ? 0 : Math.ceil(Math.round(topThickness / layerHeight));
            definition.settings.top_layers.default_value = topLayers;
            settings.top_layers = { default_value: topLayers };

            // "999999 if infill_sparse_density == 100 else math.ceil(round(bottom_thickness / resolveOrValue('layer_height'), 4))"
            const bottomThickness = definition.settings.bottom_thickness.default_value;
            const bottomLayers = infillSparseDensity === 100 ? 999999 : Math.ceil(Math.round(bottomThickness / layerHeight));
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
        if (settings.support_pattern) {
            settings.support_wall_count = settings.support_pattern.default_value === 'grid' ? { default_value: 1 } : { default_value: 0 };
        }
        if (settings.support_z_distance) { // copy cura feature
            const supportZDistance = settings.support_z_distance.default_value;
            settings.support_top_distance = { default_value: supportZDistance };
            settings.support_bottom_distance = { default_value: supportZDistance / 2 };
        }

        if (settings.cool_fan_speed) {
            const coolFanSpeed = settings.cool_fan_speed.default_value;
            settings.cool_fan_speed_min = { default_value: coolFanSpeed };
            settings.cool_fan_speed_max = { default_value: coolFanSpeed };
        }

        // fix CuraEngine z_overide_xy not effected on support_mesh
        if (hasSupportModel) {
            if (settings.support_z_distance) {
                const supportZDistance = settings.support_z_distance.default_value;
                settings.support_xy_distance = { default_value: supportZDistance };
            }
        } else if (definition.settings.support_xy_distance.default_value === definition.settings.support_z_distance.default_value) {
            settings.support_xy_distance.default_value = 0.875; // reset xy
        }
        return settings;
    }

    finalizeActiveDefinition(activeDefinition) {
        const definition = {
            definitionId: 'active_final',
            name: 'Active Profile',
            inherits: 'fdmprinter',
            metadata: {
                machine_extruder_trains: {
                    0: 'snapmaker_extruder_0',
                    1: 'snapmaker_extruder_1'
                }
            },
            settings: {},
            ownKeys: []
        };

        Object.keys(activeDefinition.settings)
            .forEach(key => {
                const setting = activeDefinition.settings[key];

                if (setting.from !== 'fdmprinter') {
                    definition.settings[key] = {
                        label: setting.label,
                        default_value: setting.default_value
                    };
                    definition.ownKeys.push(key);
                }
                if (setting.type === 'extruder') {
                    definition.settings[key] = {
                        label: setting.label,
                        default_value: '0'
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

    finalizeModelDefinition(activeDefinition) {
        const definition = {
            definitionId: 'model_final',
            name: 'Model Profile',
            inherits: 'snapmaker2',
            settings: {},
            ownKeys: []
        };
        Object.keys(activeDefinition.settings)
            .forEach(key => {
                const setting = activeDefinition.settings[key];

                if (setting.type === 'optional_extruder') {
                    definition.settings[key] = {
                        label: setting.label,
                        default_value: '0'
                    };
                    definition.ownKeys.push(key);
                }
            });
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

        const gcode = [
            ';End GCode begin',
            'M104 S0 ;extruder heater off',
            'M140 S0 ;heated bed heater off (if you have it)',
            'G90 ;absolute positioning',
            'G92 E0',
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure',
            `G1 Z${z} E-1 F3000 ;move Z up a bit and retract filament even more`,
            `G1 X${0} F3000 ;move X to min endstops, so the head is out of the way`,
            `G1 Y${y} F3000 ;so the head is out of the way and Plate is moved forward`,
            ';End GCode end'
        ];

        definition.settings.machine_end_gcode = { default_value: gcode.join('\n') };
    }

    // End Notice: only used for printing config
}

const definitionManager = new DefinitionManager();

export default definitionManager;
