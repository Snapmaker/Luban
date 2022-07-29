/* eslint-disable */
import { includes } from 'lodash';
import api from '../../api';
import i18n from '../../lib/i18n';
import {
    HEAD_CNC,
    HEAD_PRINTING,
    RIGHT_EXTRUDER_MAP_NUMBER,
    PRINTING_MATERIAL_CONFIG_KEYS_SINGLE,
    MACHINE_EXTRUDER_X,
    MACHINE_EXTRUDER_Y,
    KEY_DEFAULT_CATEGORY_CUSTOM,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY
} from '../../constants';
import PresetDefinitionModel from './PresetDefinitionModel';
import { resolveDefinition } from '../../../shared/lib/definitionResolver';
const primeTowerDefinitionKeys = [
    'prime_tower_enable',
    'prime_tower_size',
    'prime_tower_position_x',
    'prime_tower_position_y',
    'prime_tower_brim_enabled',
    'prime_tower_wipe_enabled',
];

class DefinitionManager {
    headType = HEAD_CNC;

    activeDefinition = null;

    extruderLDefinition = null;

    extruderRDefinition = null;

    defaultDefinitions = [];

    configPathname = '';

    // series = '';

    async init(headType, configPathname) {
        this.configPathname = configPathname;
        this.headType = headType;
        let res;
        // active definition
        const definitionRes = await this.getDefinition('active', false);
        this.activeDefinition = definitionRes;

        res = await api.profileDefinitions.getDefaultDefinitions(
            this.headType,
            this.configPathname
        );
        this.defaultDefinitions = res.body.definitions.map((item) => {
            item.isDefault = true;
            if (item.i18nCategory) {
                item.category = i18n._(item.i18nCategory);
            }
            if (item.i18nName) {
                item.name = i18n._(item.i18nName);
            }
            return item;
        });
        if (headType === HEAD_PRINTING) {
            res = await this.getDefinition('machine');
            this.machineDefinition = res;

            res = await this.getDefinition('snapmaker_extruder_0', false);
            this.extruderLDefinition = res;

            res = await this.getDefinition('snapmaker_extruder_1', false);
            this.extruderRDefinition = res;
            return {
                printingProfileLevel: definitionRes.printingProfileLevel,
                materialProfileLevel: definitionRes.materialProfileLevel
            };
        }else {
            return {}
        }

    }

    /**
     * Get raw definition file (for download).
     */
    async getRawDefinition(definitionId) {
        const res = await api.profileDefinitions.getRawDefinition(
            this.headType,
            definitionId,
            this.configPathname
        );
        return res.body;
    }

    async getDefinition(definitionId, isInsideCategory = true) {
        let res = {};
        if (isInsideCategory) {
            res = await api.profileDefinitions.getDefinition(
                this.headType,
                definitionId,
                this.configPathname
            );
        } else {
            res = await api.profileDefinitions.getDefinition(
                this.headType,
                definitionId
            );
        }
        const definition = res.body.definition;
        if (definition.i18nCategory) {
            definition.category = i18n._(definition.i18nCategory);
        }
        if (definition.i18nName) {
            definition.name = i18n._(definition.i18nName);
        }
        definition.isDefault = this.defaultDefinitions.findIndex(
            (d) => d.definitionId === definitionId
        ) !== -1;
        return definition;
    }

    fillCustomCategory(definition) {
        const isCustom = ({ metadata }) => {
            if (metadata?.readonly) {
                return false;
            }
            return true;
        };
        const category = definition.category || i18n._(KEY_DEFAULT_CATEGORY_CUSTOM);
        const categoryApplyI18n = definition.i18nCategory
            ? i18n._(definition.i18nCategory)
            : category;

        definition.category = isCustom(definition)
            ? category
            : categoryApplyI18n;
        definition.i18nCategory = definition.i18nCategory || '';
        return definition;
    }

    async getConfigDefinitions() {
        const res = await api.profileDefinitions.getConfigDefinitions(
            this.headType,
            this.configPathname
        );
        const definitions = await this.markDefaultDefinitions(
            res.body.definitions
        );
        return definitions.map(this.fillCustomCategory);
    }

    async getDefinitionsByPrefixName(prefix) {
        const res = await api.profileDefinitions.getDefinitionsByPrefixName(
            this.headType,
            prefix,
            this.configPathname
        );
        const definitions = await this.markDefaultDefinitions(
            res.body.definitions
        );
        const result = definitions.map((item) => {
            if ([PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY].includes(prefix)) {
                resolveDefinition(item);
            }
            return item
        }).map(this.fillCustomCategory);

        return result;
    }

    async createDefinition(definition) {
        let actualDefinition = definition;
        if (definition instanceof PresetDefinitionModel) {
            actualDefinition = definition.getSerializableDefinition()
        }
        const res = await api.profileDefinitions.createDefinition(this.headType, actualDefinition, this.configPathname);
        return res.body.definition;
    }

    async createTmpDefinition(definition, definitionName) {
        let actualDefinition = definition;
        if (definition instanceof PresetDefinitionModel) {
            actualDefinition = definition.getSerializableDefinition()
        }
        const res = await api.profileDefinitions.createTmpDefinition(
            actualDefinition,
            definitionName
        );
        return res.body.uploadName;
    }

    async removeDefinition(definition) {
        await api.profileDefinitions.removeDefinition(
            this.headType,
            definition.definitionId,
            this.configPathname
        );
    }

    async uploadDefinition(definitionId, uploadName) {
        const res = await api.profileDefinitions.uploadDefinition(
            this.headType,
            definitionId,
            uploadName,
            this.configPathname
        );
        const { err, definition } = res.body;
        if (err) {
            console.error(err);
            return null;
        } else {
            return this.fillCustomCategory(definition);
        }
    }

    // Update definition
    // Only name & settings are configurable
    async updateDefinition(definition) {
        let actualDefinition = definition;
        if (definition instanceof PresetDefinitionModel) {
            actualDefinition = definition.getSerializableDefinition()
        }
        await api.profileDefinitions.updateDefinition(
            this.headType,
            definition.definitionId,
            actualDefinition,
            this.configPathname
        );
    }

    async markDefaultDefinitions(remoteDefinitions) {
        if (!this.defaultDefinitions) {
            await this.init();
        }
        const defaultDefinitionMap = {};
        this.defaultDefinitions.forEach((item) => {
            defaultDefinitionMap[item.definitionId] = true;
        });
        remoteDefinitions.forEach((item) => {
            if (defaultDefinitionMap[item.definitionId]) {
                item.isDefault = true;
                item.name = item.i18nName ? i18n._(item.i18nName) : item.name;
                item.category = item.i18nCategory
                    ? i18n._(item.i18nCategory)
                    : item.category;
            }
        });
        return remoteDefinitions;
    }

    // Start Notice: only used for printing config
    // Calculate hidden settings
    calculateDependencies(
        settings,
        hasSupportModel,
        extruderLDefinitionSettings,
        extruderRDefinitionSettings,
        helpersExtruderConfig
    ) {
        if (settings.infill_sparse_density) {
            const infillSparseDensity = settings.infill_sparse_density.default_value;
            // L: infill_line_distance
            const infillLineWidthL = extruderLDefinitionSettings.machine_nozzle_size.default_value; // infill_line_width

            const infillLineDistanceL = infillSparseDensity < 1
                ? 0
                : ((infillLineWidthL * 100) / infillSparseDensity) * 2;
            extruderLDefinitionSettings.infill_line_distance = {
                default_value: infillLineDistanceL
            };

            // R: infill_line_distance
            const infillLineWidthR = extruderRDefinitionSettings.machine_nozzle_size.default_value; // infill_line_width

            const infillLineDistanceR = infillSparseDensity < 1
                ? 0
                : ((infillLineWidthR * 100) / infillSparseDensity) * 2;
            extruderRDefinitionSettings.infill_line_distance = {
                default_value: infillLineDistanceR
            };

            // top_layers & bottom_layers
            if (settings.infill_sparse_density.default_value === 100) {
                settings.top_layers = { default_value: 0 };
                settings.bottom_layers = { default_value: 999999 };
            }
        }

        if (settings.wall_thickness) {
            // "1 if magic_spiralize else max(1, round((wall_thickness - wall_line_width_0) / wall_line_width_x) + 1) if wall_thickness != 0 else 0"
            const wallThickness = settings.wall_thickness.default_value;

            // L: wall_line_count
            const wallOutLineWidthL = extruderLDefinitionSettings.machine_nozzle_size.default_value; // wall_line_width_0
            const wallInnerLineWidthL = extruderLDefinitionSettings.machine_nozzle_size.default_value; // wall_line_width_x
            const wallLineCountL = wallThickness !== 0
                ? Math.max(
                    1,
                    Math.round(
                        (wallThickness - wallOutLineWidthL)
                                  / wallInnerLineWidthL
                    ) + 1
                )
                : 0;
            extruderLDefinitionSettings.wall_line_count = {
                default_value: wallLineCountL
            };

            // R: wall_line_count
            const wallOutLineWidthR = extruderRDefinitionSettings.machine_nozzle_size.default_value; // wall_line_width_0
            const wallInnerLineWidthR = extruderRDefinitionSettings.machine_nozzle_size.default_value; // wall_line_width_x
            const wallLineCountR = wallThickness !== 0
                ? Math.max(
                    1,
                    Math.round(
                        (wallThickness - wallOutLineWidthR)
                                  / wallInnerLineWidthR
                    ) + 1
                )
                : 0;
            extruderRDefinitionSettings.wall_line_count = {
                default_value: wallLineCountR
            };
        }

        if (settings.layer_height) {
            const layerHeight = settings.layer_height.default_value;
            const infillSparseDensity = settings.infill_sparse_density.default_value;

            // "0 if infill_sparse_density == 100 else math.ceil(round(top_thickness / resolveOrValue('layer_height'), 4))"
            const topThickness = settings.top_thickness.default_value;
            const topLayers = infillSparseDensity === 100
                ? 0
                : Math.ceil(topThickness / layerHeight);
            settings.top_layers.default_value = topLayers;
            settings.top_layers = { default_value: topLayers };

            // "999999 if infill_sparse_density == 100 else math.ceil(round(bottom_thickness / resolveOrValue('layer_height'), 4))"
            const bottomThickness = settings.bottom_thickness.default_value;
            const bottomLayers = infillSparseDensity === 100
                ? 999999
                : Math.ceil(bottomThickness / layerHeight);
            settings.bottom_layers.default_value = bottomLayers;
            settings.bottom_layers = { default_value: bottomLayers };
        }
        if (settings.speed_print_layer_0) {
            // "skirt_brim_speed = speed_print_layer_0"
            const speedPrintLayer0 = settings.speed_print_layer_0.default_value;
            settings.skirt_brim_speed = { default_value: speedPrintLayer0 };
        }
        if (settings.support_infill_rate) {
            const supportInfillRate = settings.support_infill_rate.default_value;
            let supportLineWidth;
            if (helpersExtruderConfig.support === RIGHT_EXTRUDER_MAP_NUMBER) {
                supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size
                    .default_value; // support_line_width
            } else {
                supportLineWidth = extruderLDefinitionSettings.machine_nozzle_size
                    .default_value; // support_line_width
            }

            // "0 if support_infill_rate == 0 else (support_line_width * 100) / support_infill_rate *
            // (2 if support_pattern == 'grid' else (3 if support_pattern == 'triangles' else 1))"
            const supportPattern = settings.support_pattern.default_value;
            let supportPatternRate = 1;
            if (supportPattern === 'grid') {
                supportPatternRate = 2;
            } else if (supportPattern === 'triangles') {
                supportPatternRate = 3;
            }
            settings.support_line_distance.default_value = supportInfillRate === 0
                ? 0
                : ((supportLineWidth * 100) / supportInfillRate)
                      * supportPatternRate;
            settings.support_initial_layer_line_distance.default_value = settings.support_line_distance.default_value;
        }
        if (settings.support_pattern) {
            settings.support_wall_count = settings.support_pattern.default_value === 'grid'
                ? { default_value: 1 }
                : { default_value: 0 };
        }
        if (settings.support_z_distance) {
            // copy cura feature
            const supportZDistance = settings.support_z_distance.default_value;
            settings.support_top_distance = { default_value: supportZDistance };
            settings.support_bottom_distance = {
                default_value: supportZDistance / 2
            };
        }
        // TODO: useless
        if (settings.cool_fan_speed) {
            const coolFanSpeed = settings.cool_fan_speed.default_value;
            settings.cool_fan_speed_min = { default_value: coolFanSpeed };
            settings.cool_fan_speed_max = { default_value: coolFanSpeed };
        }

        // fix CuraEngine z_overide_xy not effected on support_mesh
        if (hasSupportModel) {
            if (settings.support_z_distance) {
                const supportZDistance = settings.support_z_distance.default_value;
                settings.support_xy_distance = {
                    default_value: supportZDistance
                };
            }
        } else if (
            settings.support_xy_distance.default_value
            === settings.support_z_distance.default_value
        ) {
            settings.support_xy_distance.default_value = 0.875; // reset xy
        }
        return {
            settings,
            extruderLDefinitionSettings,
            extruderRDefinitionSettings,
        };
    }

    finalizeActiveDefinition(
        activeDefinition,
        extruderDefinition,
        size,
        hasPrimeTower = false
    ) {
        // Prepare definition file
        const definition = {
            definitionId: 'active_final',
            name: 'Active Profile',
            inherits: 'fdmprinter',
            metadata: {
                machine_extruder_trains: {
                    0: 'snapmaker_extruder_0',
                    1: 'snapmaker_extruder_1',
                },
            },
            settings: {
                machine_width: {
                    default_value: size.x
                },
                machine_depth: {
                    default_value: size.y
                },
                machine_height: {
                    default_value: size.z
                }
            },
            ownKeys: ['machine_width', 'machine_depth', 'machine_height']
        };

        Object.keys(activeDefinition.settings).forEach((key) => {
            const setting = activeDefinition.settings[key];

            if (
                // setting.from !== 'fdmprinter'
                // &&
                !['machine_width', 'machine_depth', 'machine_height'].includes(
                    key
                )
            ) {
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
            if (hasPrimeTower) {
                if (includes(primeTowerDefinitionKeys, key)) {
                    definition.settings[key] = {
                        label: setting.label,
                        default_value: setting.default_value
                    };
                    definition.ownKeys.push(key);
                }
            }
        });
        definition.ownKeys.push('machine_start_gcode');
        definition.ownKeys.push('machine_end_gcode');
        this.addMachineStartGcode(definition, extruderDefinition);
        this.addMachineEndGcode(definition);

        return definition;
    }

    finalizeModelDefinition(
        qualityDefinition,
        item,
        extruderLDefinition,
        extruderRDefinition
    ) {
        const definition = {
            definitionId: 'model_final',
            name: 'Model Profile',
            settings: {},
            ownKeys: [],
        };
        Object.keys(qualityDefinition.settings).forEach((key) => {
            const setting = qualityDefinition.settings[key];

            if (setting.type === 'optional_extruder') {
                definition.settings[key] = {
                    label: setting.label,
                    default_value: '0'
                };
                definition.ownKeys.push(key);
            }
        });
        const meshKeys = [
            'infill_line_distance',
            'infill_line_width',
            'wall_line_count',
            'wall_line_width',
            'wall_line_width_0',
            'wall_line_width_x',
            'skin_line_width',
            'wall_0_material_flow',
            'wall_x_material_flow',
            'skin_material_flow',
            'roofing_material_flow',
            'infill_material_flow',
            'material_flow_layer_0',
        ];
        meshKeys.forEach((key) => {
            definition.settings[key] = {
                default_value: 0,
            };
            definition.ownKeys.push(key);
        });

        definition.settings.infill_extruder_nr.default_value = item.extruderConfig.infill;
        definition.settings.wall_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.wall_0_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.wall_x_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.roofing_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.top_bottom_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.material_flow_layer_0.default_value = qualityDefinition.settings.material_flow_layer_0.default_value;
        if (item.extruderConfig.infill === '0') {
            definition.settings.infill_line_distance.default_value = extruderLDefinition.settings.infill_line_distance.default_value;
            definition.settings.infill_line_width.default_value = extruderLDefinition.settings.infill_line_width.default_value;
            definition.settings.infill_material_flow.default_value = extruderLDefinition.settings.material_flow.default_value;
        } else {
            definition.settings.infill_line_distance.default_value = extruderRDefinition.settings.infill_line_distance.default_value;
            definition.settings.infill_line_width.default_value = extruderRDefinition.settings.infill_line_width.default_value;
            definition.settings.infill_material_flow.default_value = extruderRDefinition.settings.material_flow.default_value;
        }

        if (item.extruderConfig.shell === '0') {
            definition.settings.wall_line_count.default_value = extruderLDefinition.settings.wall_line_count.default_value;
            definition.settings.wall_line_width.default_value = extruderLDefinition.settings.wall_line_width.default_value;
            definition.settings.wall_line_width_0.default_value = extruderLDefinition.settings.wall_line_width_0.default_value;
            definition.settings.wall_line_width_x.default_value = extruderLDefinition.settings.wall_line_width_x.default_value;
            definition.settings.skin_line_width.default_value = extruderLDefinition.settings.skin_line_width.default_value;
            definition.settings.wall_x_material_flow.default_value = extruderLDefinition.settings.material_flow.default_value;
            definition.settings.wall_0_material_flow.default_value = extruderLDefinition.settings.material_flow.default_value;
            definition.settings.skin_material_flow.default_value = extruderLDefinition.settings.material_flow.default_value;
            definition.settings.roofing_material_flow.default_value = extruderLDefinition.settings.material_flow.default_value;
        } else {
            definition.settings.wall_line_count.default_value = extruderRDefinition.settings.wall_line_count.default_value;
            definition.settings.wall_line_width.default_value = extruderRDefinition.settings.wall_line_width.default_value;
            definition.settings.wall_line_width_0.default_value = extruderRDefinition.settings.wall_line_width_0.default_value;
            definition.settings.wall_line_width_x.default_value = extruderRDefinition.settings.wall_line_width_x.default_value;
            definition.settings.skin_line_width.default_value = extruderRDefinition.settings.skin_line_width.default_value;
            definition.settings.wall_x_material_flow.default_value = extruderRDefinition.settings.material_flow.default_value;
            definition.settings.wall_0_material_flow.default_value = extruderRDefinition.settings.material_flow.default_value;
            definition.settings.skin_material_flow.default_value = extruderRDefinition.settings.material_flow.default_value;
            definition.settings.roofing_material_flow.default_value = extruderRDefinition.settings.material_flow.default_value;
        }
        return definition;
    }

    finalizeExtruderDefinition({
        extruderDefinition,
        materialDefinition,
        hasPrimeTower,
        primeTowerXDefinition,
        primeTowerYDefinition
    }) {
        const definition = {
            ...extruderDefinition,
        };
        const settings = definition.settings;
        const materialFlow = materialDefinition.settings.material_flow;
        if (materialFlow) {
            const extruderKey = [
                'skirt_brim_material_flow',
                'support_material_flow',
                'support_interface_material_flow',
                'prime_tower_flow'
            ];
            extruderKey.forEach((key) => {
                definition.settings[key] = {
                    default_value: materialFlow.default_value
                };
            });
        }
        const switchExtruderRetractionSpeeds = materialDefinition.settings.switch_extruder_retraction_speeds;
        if (switchExtruderRetractionSpeeds) {
            const nozzleSizeRelationSettingsKeys = [
                'switch_extruder_retraction_speed',
                'switch_extruder_prime_speed'
            ];
            for (const key of nozzleSizeRelationSettingsKeys) {
                if (!definition.settings[key]) {
                    definition.settings[key] = {};
                }
                definition.settings[key].default_value = switchExtruderRetractionSpeeds.default_value;
            }
        }
        // TODO: move 'machine_nozzle_size' to materialDefinition
        const nozzleSize = settings.machine_nozzle_size.default_value;
        if (nozzleSize) {
            const nozzleSizeRelationSettingsKeys = [
                'wall_line_width_0',
                'wall_line_width_x',
                'skin_line_width',
                'infill_line_width',
                'skirt_brim_line_width',
                'support_line_width',
                'support_interface_line_width',
                'support_roof_line_width',
                'support_bottom_line_width',
                'prime_tower_line_width'
            ];
            for (const key of nozzleSizeRelationSettingsKeys) {
                definition.settings[key].default_value = nozzleSize;
            }
        }
        PRINTING_MATERIAL_CONFIG_KEYS_SINGLE.concat(
            'cool_fan_speed_min',
            'cool_fan_speed_max'
        ).forEach((key) => {
            const setting = materialDefinition.settings[key];
            if (setting) {
                definition.settings[key] = {
                    default_value: setting.default_value,
                };
            }
        });
        if (hasPrimeTower) {
            MACHINE_EXTRUDER_X.forEach((keyItem) => {
                definition.settings[
                    keyItem
                ].default_value = primeTowerXDefinition;
            });
            MACHINE_EXTRUDER_Y.forEach((keyItem) => {
                definition.settings[
                    keyItem
                ].default_value = primeTowerYDefinition;
            });
        }
        return definition;
    }

    addMachineStartGcode(definition, extruderDefinition) {
        const settings = extruderDefinition.settings;

        const machineHeatedBed = settings.machine_heated_bed.default_value;
        const printTemp = settings.material_print_temperature.default_value;
        const printTempLayer0 = settings.material_print_temperature_layer_0.default_value
            || printTemp;
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

        const gcode = [';Start GCode begin', `M104 S${printTempLayer0}`];
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
        definition.settings.machine_start_gcode = {
            default_value: gcode.join('\n')
        };
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
            ';End GCode end',
        ];

        definition.settings.machine_end_gcode = {
            default_value: gcode.join('\n')
        };
    }

    // End Notice: only used for printing config
}

const definitionManager = new DefinitionManager();

export default definitionManager;
