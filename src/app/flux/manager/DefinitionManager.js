/* eslint-disable */
import { cloneDeep, includes } from 'lodash';
// import { resolveDefinition } from '../../../shared/lib/definition-resolver';
import { resolveParameterValues, resetPresetsContext, PrintMode, getParameterItem } from '@snapmaker/luban-platform';

import api from '../../api';
import {
    HEAD_CNC,
    HEAD_PRINTING,
    MATERIAL_REGEX,
    QUALITY_REGEX
} from '../../constants';
import { PRESET_CATEGORY_CUSTOM } from '../../constants/preset';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import { PresetModel } from '../../preset-model';
import scene from '../../scene/Scene';

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
    'prime_tower_line_width',
    'wall_line_count'
];
const extruderRelationSettingsKeys = [
    'machine_nozzle_size',
];

const QUALITY_PRESET_FIXED_KEYS = new Set([
    'machine_nozzle_size',
]);



class DefinitionManager {
    headType = HEAD_CNC;

    activeDefinition = null;

    extruderLDefinition = null;

    extruderRDefinition = null;

    qualityProfileArr;

    defaultDefinitions = [];

    machineDefinition = null;

    materialProfileArr = [];

    extruderProfileArr = [];

    printingProfileLevel = {};

    materialProfileLevel = {};

    changedArray = [];

    configPathname = '';

    // series = '';

    async init(headType, configPathname) {
        log.info('DefinitionManager.init', headType, configPathname);

        this.configPathname = configPathname;
        this.headType = headType;
        let res;

        resetPresetsContext();

        // active definition
        const definitionRes = await this.getDefinition('active', false);
        this.activeDefinition = definitionRes;

        if (headType === HEAD_PRINTING) {
            res = await this.getDefinition('machine');
            this.machineDefinition = res;

            this.changedArray = Object.keys(this.machineDefinition.settings)
                .filter(key => !QUALITY_PRESET_FIXED_KEYS.has(key))
                .map((key) => {
                    const settingItem = this.machineDefinition.settings[key];
                    const value = settingItem.default_value;
                    return [key, value];
                });
        }

        // default profiles
        res = await api.profileDefinitions.getDefaultDefinitions(this.headType, this.configPathname);

        this.defaultDefinitions = res.body.definitions.map((definition) => {
            definition.isDefault = true;
            if (definition.i18nName) {
                definition.name = i18n._(definition.i18nName);
            }
            if (definition.i18nCategory) {
                definition.i18nCategory = i18n._(definition.i18nCategory);
            }

            // Use a special context key, avoid to conflict with the config we are using
            this.resolveMachineDefinition(definition, {
                contextKey: `DefaultConfig-${definition.definitionId}`,
            });
            return definition;
        });

        // extruder
        if (headType === HEAD_PRINTING) {
            let machineExtruders = {};
            if (this.machineDefinition.metadata) {
                machineExtruders = this.machineDefinition.metadata.machine_extruder_trains;
            }

            const extruderCount = this.machineDefinition.settings.machine_extruder_count?.default_value || 1;

            if (extruderCount >= 1) {
                if (machineExtruders) {
                    res = await this.getDefinition(machineExtruders['0'], true);
                } else {
                    res = await this.getDefinition('snapmaker_extruder_0', false);
                }
                this.extruderLDefinition = res;
            } else {
                this.extruderLDefinition = null;
            }

            if (extruderCount >= 2) {
                if (machineExtruders) {
                    res = await this.getDefinition(machineExtruders['1'], true);
                } else {
                    res = await this.getDefinition('snapmaker_extruder_1', false);
                }
                this.extruderRDefinition = res;
            } else {
                this.extruderRDefinition = null;
            }
        } else {
            return {};
        }

        const parameterKeysResult = await api.profileDefinitions.getPresetParameterKeys();
        this.extruderProfileArr = parameterKeysResult.body.extruderProfileArr;
        this.materialProfileArr = parameterKeysResult.body.materialProfileArr;
        this.qualityProfileArr = parameterKeysResult.body.qualityProfileArr;
        this.printingProfileLevel = parameterKeysResult.body.printingProfileLevel;
        this.materialProfileLevel = parameterKeysResult.body.materialProfileLevel;
    }

    /**
     * Apply parameters from machine to preset.
     */
    resolveMachineDefinition(definition, options = {}) {
        options.contextKey = options.contextKey || '';

        if (MATERIAL_REGEX.test(definition.definitionId)) {
            resolveParameterValues(definition, this.changedArray, options);
        } else if (QUALITY_REGEX.test(definition.definitionId)) {
            // Make sure nozzle size is taken from definition itself
            const changedArray = [
                ...this.changedArray,
                // ['machine_nozzle_size', definition.settings.machine_nozzle_size.default_value],
            ];
            resolveParameterValues(definition, changedArray, options);
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
        if (MATERIAL_REGEX.test(definitionId) || QUALITY_REGEX.test(definitionId)) {
            this.resolveMachineDefinition(definition);
        }
        if (definition.i18nCategory) {
            definition.i18nCategory = i18n._(definition.i18nCategory);
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
        definition.category = definition.category || PRESET_CATEGORY_CUSTOM;
        definition.i18nCategory = i18n._(definition.i18nCategory || '');
        return definition;
    }

    async getConfigDefinitions() {
        const res = await api.profileDefinitions.getConfigDefinitions(this.headType, this.configPathname);
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

        const result = definitions
            .map((definition) => {
                this.resolveMachineDefinition(definition);
                return definition;
            })
            .map(this.fillCustomCategory);

        return result;
    }

    async createDefinition(definition) {
        let actualDefinition = definition;
        if (definition instanceof PresetModel) {
            actualDefinition = definition.getSerializableDefinition();
        }
        const res = await api.profileDefinitions.createDefinition(this.headType, actualDefinition, this.configPathname);

        const newDefinition = res.body.definition;
        this.resolveMachineDefinition(newDefinition);
        return newDefinition;
    }

    async createTmpDefinition(definition, definitionName) {
        let actualDefinition = definition;
        if (definition instanceof PresetModel) {
            actualDefinition = definition.getSerializableDefinition();
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
        const { err } = res.body;
        if (err) {
            console.error(err);
            return null;
        } else {
            const newDefinition = res.body.definition;
            this.resolveMachineDefinition(newDefinition);
            return this.fillCustomCategory(newDefinition);
        }
    }

    // Update definition
    // Only name & settings are configurable
    async updateDefinition(definition) {
        let actualDefinition = definition;
        if (definition instanceof PresetModel) {
            actualDefinition = definition.getSerializableDefinition();
        }

        await api.profileDefinitions.updateDefinition(
            this.headType,
            definition.definitionId,
            actualDefinition,
            this.configPathname
        );
    }

    async updateMachineDefinition(
        {
            machineDefinition,
            materialDefinitions,
            qualityDefinitions
        }
    ) {
        this.changedArray = Object.keys(this.machineDefinition.settings)
            .filter(key => !QUALITY_PRESET_FIXED_KEYS.has(key))
            .map((key) => {
                const settingItem = this.machineDefinition.settings[key];
                const value = settingItem.default_value;
                return [key, value];
            });

        await this.updateDefinition(machineDefinition);

        materialDefinitions.forEach((item) => {
            this.resolveMachineDefinition(item);
        });
        qualityDefinitions.forEach((item) => {
            this.resolveMachineDefinition(item);
        });
        return {
            newMaterialDefinitions: materialDefinitions,
            newQualityDefinitions: qualityDefinitions
        };
    }

    async updateDefaultDefinition(definition) {
        let actualDefinition = definition;
        if (definition instanceof PresetModel) {
            actualDefinition = definition.getSerializableDefinition();
        }
        await api.profileDefinitions.updateDefaultDefinition(
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
                item.i18nCategory = i18n._(item.i18nCategory || item.category);
            }
        });
        return remoteDefinitions;
    }

    // Start Notice: only used for printing config
    // Calculate hidden settings
    calculateDependencies(
        settings,
        hasSupportModel
    ) {
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
    }

    _applyGlobalExtruderParameters(definition, qualityDefinition, extruderDefinition, limitToExtruderKeys) {
        for (const key of Object.keys(extruderDefinition.settings)) {
            const settingItem = qualityDefinition.settings[key];

            // if (settingItem && settingItem.settable_per_extruder && includes(limitToExtruderKeys, settingItem.limit_to_extruder)) {
            if (settingItem && includes(limitToExtruderKeys, settingItem.limit_to_extruder)) {
                if (!definition.settings[key]) {
                    definition.settings[key] = {};
                    definition.ownKeys.push(key);
                }
                definition.settings[key].default_value = extruderDefinition.settings[key].default_value;
            }
        }
    }

    _applyModelExtruderParameters(definition, qualityDefinition, extruderDefinition, limitToExtruderKeys) {
        for (const key of Object.keys(extruderDefinition.settings)) {
            const settingItem = getParameterItem(key);

            if (settingItem && settingItem.settable_per_mesh && includes(limitToExtruderKeys, settingItem.limit_to_extruder)) {
                if (!definition.settings[key]) {
                    definition.settings[key] = {};
                    definition.ownKeys.push(key);
                }
                definition.settings[key].default_value = extruderDefinition.settings[key].default_value;
            }
        }
    }

    finalizeActiveDefinition(
        printMode,
        activeDefinition,
        leftPreset,
        rightPreset,
        extruderLDefinition,
        extruderRDefinition,
        size,
        isDual,
        helpersExtruderConfig,
        supportExtruderConfig,
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
            settings: {},
            ownKeys: [],
        };

        Object.keys(activeDefinition.settings).forEach((key) => {
            const setting = activeDefinition.settings[key];

            if (!['machine_width', 'machine_depth', 'machine_height'].includes(key)) {
                definition.settings[key] = {
                    label: setting.label,
                    default_value: setting.default_value
                };
                definition.ownKeys.push(key);
            }
        });

        // Add machine size
        definition.ownKeys.push('machine_width', 'machine_depth', 'machine_height');
        definition.settings.machine_width = { default_value: size.x };
        definition.settings.machine_depth = { default_value: size.y };
        definition.settings.machine_height = { default_value: size.z };

        // Add Start/End G-code
        definition.ownKeys.push('machine_start_gcode');
        definition.ownKeys.push('machine_end_gcode');

        const firstLayerDefinition = helpersExtruderConfig.adhesion === '0' ? extruderLDefinition : extruderRDefinition;
        // TODO: Refactor this hard-code
        const isJ1 = activeDefinition.settings['machine_name'].default_value === 'Snapmaker J1';
        const isArtisan = activeDefinition.settings['machine_name'].default_value === 'Snapmaker Artisan';

        if (isJ1) {
            this.addMachineStartGcodeJ1(printMode, definition, firstLayerDefinition);
        } else if (isArtisan) {
            this.addMachineStartGcodeArtisan(printMode, definition, firstLayerDefinition);
        } else {
            this.addMachineStartGcode(definition, firstLayerDefinition);
        }

        if (isJ1) {
            this.addMachineEndGcodeJ1(printMode, definition);
        } else if (isArtisan) {
            this.addMachineEndGcodeArtisan(printMode, definition);
        } else {
            this.addMachineEndGcode(definition);
        }

        // apply adhesion parameters
        definition.ownKeys.push(
            // adhesion
            'adhesion_extruder_nr',
            'skirt_brim_extruder_nr',
            'raft_base_extruder_nr',
            'raft_interface_extruder_nr',
            'raft_surface_extruder_nr',

            // support
            'support_extruder_nr',
            'support_interface_extruder_nr',
            'support_roof_extruder_nr',
            'support_bottom_extruder_nr',
            'support_infill_extruder_nr',
            'support_extruder_nr_layer_0',
        );
        definition.settings.adhesion_extruder_nr.default_value = helpersExtruderConfig.adhesion;
        definition.settings.skirt_brim_extruder_nr.default_value = helpersExtruderConfig.adhesion;
        definition.settings.raft_base_extruder_nr.default_value = helpersExtruderConfig.adhesion;
        definition.settings.raft_interface_extruder_nr.default_value = helpersExtruderConfig.adhesion;
        definition.settings.raft_surface_extruder_nr.default_value = helpersExtruderConfig.adhesion;

        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            helpersExtruderConfig.adhesion === '0' ? extruderLDefinition : extruderRDefinition,
            [
                'adhesion_extruder_nr',
                'skirt_brim_extruder_nr',
                'raft_base_extruder_nr',
                'raft_interface_extruder_nr',
                'raft_surface_extruder_nr',
            ],
        );
        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            helpersExtruderConfig.adhesion === '0' ? leftPreset : rightPreset,
            [
                'adhesion_extruder_nr',
                'skirt_brim_extruder_nr',
                'raft_base_extruder_nr',
                'raft_interface_extruder_nr',
                'raft_surface_extruder_nr',
            ],
        );

        // apply support parameters
        definition.settings.support_extruder_nr.default_value = supportExtruderConfig.support;
        definition.settings.support_extruder_nr_layer_0.default_value = supportExtruderConfig.support;
        definition.settings.support_infill_extruder_nr.default_value = supportExtruderConfig.support;

        definition.settings.support_interface_extruder_nr.default_value = supportExtruderConfig.interface;
        definition.settings.support_roof_extruder_nr.default_value = supportExtruderConfig.interface;
        definition.settings.support_bottom_extruder_nr.default_value = supportExtruderConfig.interface;

        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            supportExtruderConfig.support === '0' ? extruderLDefinition : extruderRDefinition,
            [
                'support_extruder_nr',
                'support_extruder_nr_layer_0',
                'support_infill_extruder_nr',
            ],
        );
        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            supportExtruderConfig.support === '0' ? leftPreset : rightPreset,
            [
                'support_extruder_nr',
                'support_extruder_nr_layer_0',
                'support_infill_extruder_nr',
            ],
        );

        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            supportExtruderConfig.interface === '0' ? extruderLDefinition : extruderRDefinition,
            [
                'support_interface_extruder_nr',
                'support_roof_extruder_nr',
                'support_bottom_extruder_nr',
            ],
        );

        this._applyGlobalExtruderParameters(
            definition,
            activeDefinition,
            supportExtruderConfig.interface === '0' ? leftPreset : rightPreset,
            [
                'support_interface_extruder_nr',
                'support_roof_extruder_nr',
                'support_bottom_extruder_nr',
            ],
        );

        // Lift parameters of left extruder to global
        for (const key of Object.keys(extruderLDefinition.settings)) {
            const settingItem = activeDefinition.settings[key];

            // It's material parameter, but not extruder parameter
            if (settingItem && !settingItem.settable_per_extruder && this.materialProfileArr.includes(key)) {
                if (!definition.settings[key]) {
                    definition.settings[key] = {};
                    definition.ownKeys.push(key);
                }
                definition.settings[key].default_value = extruderLDefinition.settings[key].default_value;
            }
        }

        return definition;
    }

    // TODO: Consider right
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

        definition.settings.infill_extruder_nr.default_value = item.extruderConfig.infill;
        definition.settings.wall_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.wall_0_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.wall_x_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.roofing_extruder_nr.default_value = item.extruderConfig.shell;
        definition.settings.top_bottom_extruder_nr.default_value = item.extruderConfig.shell;

        // TODO: ?
        // definition.settings.material_flow_layer_0.default_value = qualityDefinition.settings.material_flow_layer_0.default_value;

        this._applyModelExtruderParameters(
            definition,
            qualityDefinition,
            item.extruderConfig.infill === '0' ? extruderLDefinition : extruderRDefinition,
            ['infill_extruder_nr']
        );

        this._applyModelExtruderParameters(
            definition,
            qualityDefinition,
            item.extruderConfig.shell === '0' ? extruderLDefinition : extruderRDefinition,
            ['wall_extruder_nr', 'wall_0_extruder_nr', 'wall_x_extruder_nr', 'roofing_extruder_nr', 'top_bottom_extruder_nr'],
        );

        return definition;
    }

    finalizeExtruderDefinition(
        {
            activeQualityDefinition,
            extruderDefinition,
            materialDefinition,
        }
    ) {
        const newExtruderDefinition = {
            ...extruderDefinition,
            settings: cloneDeep(extruderDefinition.settings),
        };

        // Apply quality preset
        const newQualityDefinition = {
            settings: cloneDeep(activeQualityDefinition.settings),
        };
        const nozzleSize = newExtruderDefinition?.settings?.machine_nozzle_size?.default_value;
        if (nozzleSize && newExtruderDefinition.definitionId === 'snapmaker_extruder_1') {
            resolveParameterValues(newQualityDefinition, [['machine_nozzle_size', nozzleSize]]);
        }

        this.extruderProfileArr.concat(nozzleSizeRelationSettingsKeys).forEach((item) => {
            if (newQualityDefinition.settings[item]) {
                newExtruderDefinition.settings[item] = {
                    default_value: newQualityDefinition.settings[item].default_value,
                };
            }
        });

        // Apply material preset
        this.materialProfileArr.forEach((key) => {
            const setting = materialDefinition.settings[key];
            if (setting) {
                newExtruderDefinition.settings[key] = {
                    default_value: setting.default_value,
                };
            }
        });

        // Go through a filter on extruders
        const extruderKeysAllowed = this.extruderProfileArr;
        const newSettings = {};
        for (const key of extruderKeysAllowed) {
            // FIXME: This is a hot fix only, please correct extruder key later
            // do not write to final config file
            const settingItem = getParameterItem(key);
            if (settingItem && !settingItem.settable_per_extruder && !settingItem.settable_per_mesh) {
                // not in material
                if (!includes(this.materialProfileArr, key)) {
                    continue;
                }
            }
            if (newExtruderDefinition.settings[key]) {
                newSettings[key] = {
                    default_value: newExtruderDefinition.settings[key].default_value,
                };
            }
        }
        newExtruderDefinition.settings = newSettings;

        return newExtruderDefinition;
    }

    addMachineStartGcode(definition, extruderDefinition) {
        const settings = extruderDefinition.settings;

        const machineHeatedBed = definition.settings.machine_heated_bed.default_value;
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

        const gcode = [';Start GCode begin'];
        gcode.push('G28 ;home');
        gcode.push(`M104 S${printTempLayer0}`);
        if (machineHeatedBed) {
            gcode.push(`M140 S${bedTempLayer0}`);
        }
        gcode.push(`M109 S${printTempLayer0} ;Wait for Hotend Temperature`);
        if (machineHeatedBed) {
            gcode.push(`M190 S${bedTempLayer0} ;Wait for Bed Temperature`);
        }

        gcode.push('G90 ;absolute positioning');
        gcode.push('G0 X-10 Y-10 F3000');
        gcode.push('G0 Z0 F1800');

        // Pre-extrusion
        gcode.push('G92 E0');
        gcode.push('G1 E20 F200');
        gcode.push('G0 X0 Y0 F3000 ;Move to origin');
        gcode.push('G0 Z1 F1800 ;Move up to avoid scraping against heated bed');

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

    addMachineStartGcodeJ1(printMode, definition, extruderDefinition) {
        const settings = extruderDefinition.settings;

        const printTemp = settings.material_print_temperature.default_value;
        const printTempLayer0 = settings.material_print_temperature_layer_0.default_value
            || printTemp;
        const bedTempLayer0 = settings.material_bed_temperature_layer_0.default_value;

        let printModeCode = '';
        switch (printMode) {
            case PrintMode.Default:
                printModeCode = 'M605 S0';
                break;
            case PrintMode.IDEXDuplication:
                printModeCode = 'M605 S2 X162 R0';
                break;
            case PrintMode.IDEXMirror:
                printModeCode = 'M605 S3';
                break;
            case PrintMode.IDEXBackup:
                printModeCode = 'M605 S4';
                break;
        }

        // ;--- Start G-code Begin ---
        // M104 S{material_print_temperature_layer_0} ;Set Hotend Temperature
        // M140 S{material_bed_temperature_layer_0} ;Set Bed Temperature
        // G28 ;Home
        // G1 Z0.8
        // M109 S{material_print_temperature_layer_0}
        // M190 S{material_bed_temperature_layer_0}
        // G1 Z0.8 F6000
        // M201 X10000 Y10000 Z500 E5000
        // M205 V5
        // G92 E0
        // G1 F200 E2
        // G92 E0
        // ;--- Start G-code End ---
        const gcode = [
            ';--- Start G-code Begin ---',
            printModeCode,
            `M104 S${printTempLayer0} ;Set Hotend Temperature`,
            `M140 S${bedTempLayer0} ;Set Bed Temperature`,
            'G28 ;home',
            'G1 Z0.8',
            `M109 S${printTempLayer0}`,
            `M190 S${bedTempLayer0}`,
            'G1 Z0.8 F6000',
            'M201 X10000 Y10000 Z500 E5000',
            'M205 V5',
            'G92 E0',
            'G1 F200 E2',
            'G92 E0',
            ';--- Start G-code End ---',
        ];

        definition.settings.machine_start_gcode = {
            default_value: gcode.join('\n')
        };
    }

    addMachineEndGcodeJ1(printMode, definition) {
        // ;--- End G-code Begin ---
        // M104 S0
        // M140 S0
        // G92 E0
        // G1 E-1 F300 ;retract the filament
        // G92 E0
        // G28 Z
        // G28 X0 Y0
        // M84
        // ;--- End G-code End ---
        const gcode = [
            ';--- End G-code Begin ---',
            'M104 S0',
            'M140 S0',
            'G92 E0',
            'G1 E-1 F300 ;retract the filament',
            'G92 E0',
            'G28 Z',
            'G28 X0 Y0',
            'M84',
            ';--- End G-code End ---',
        ];

        definition.settings.machine_end_gcode = {
            default_value: gcode.join('\n')
        };
    }

    addMachineStartGcodeArtisan(printMode, definition, extruderDefinition) {
        const settings = extruderDefinition.settings;

        const printTemp = settings.material_print_temperature.default_value;
        const printTempLayer0 = settings.material_print_temperature_layer_0.default_value
            || printTemp;
        const bedTempLayer0 = settings.material_bed_temperature_layer_0.default_value;

        // Check if we are using inner circuit bed heating or full area bed heating
        // M140 P0: inner circuit
        // M140 P1: full area circuit
        // M140: using the last setting
        const modelGroup = scene.getModelGroup();
        let hasOversteppedHotArea = false;
        for (const model of modelGroup.getModels()) {
            hasOversteppedHotArea |= !!model.hasOversteppedHotArea;
        }

        // ;--- Start G-code Begin ---
        // M205 J0.05
        // M201 X10000 Y10000 Z100 E10000
        // M204 P1000 T2000 R10000
        // M900 T0 K0.035
        // M900 T1 K0.035
        // M104 S{material_print_temperature_layer_0} ;Set Hotend Temperature
        // M140 S{material_bed_temperature_layer_0} ;Set Bed Temperature
        // M109 T0 S{material_print_temperature_layer_0} ;Wait Hotend Temperature
        // M190 S{material_bed_temperature_layer_0} ;Set Bed Temperature
        // M107
        // M107 P1
        // G28
        // G0 Z0.5 X0 Y-0.5 F6000
        // G92 E0
        // G0 X150 E30 F1200
        // G92 E0
        // G1 Z5 F6000
        // ;--- Start G-code End ---
        const m140Command = hasOversteppedHotArea ? 'M140 P1' : 'M140 P0';
        const m190Command = hasOversteppedHotArea ? 'M190 P1' : 'M190 P0';
        const gcode = [
            ';--- Start G-code Begin ---',
            'M205 J0.05',
            'M201 X10000 Y10000 Z100 E10000',
            'M204 P1000 T2000 R10000',
            'M900 T0 K0.035',
            'M900 T1 K0.035',
            `M104 S${printTempLayer0} ;Set Hotend Temperature`,
            `${m140Command} S${bedTempLayer0} ;Set Bed Temperature`,
            `M109 S${printTempLayer0} ;Wait Hotend Temperature`,
            `${m190Command} S${bedTempLayer0} ;Set Bed Temperature`,
            'M107',
            'M107 P1',
            'G28',
            'G0 Z0.5 X0 Y-0.5 F6000',
            'G92 E0',
            'G0 X150 E30 F1200',
            'G92 E0',
            'G1 Z5 F6000',
            ';--- Start G-code End ---',
        ];

        definition.settings.machine_start_gcode = {
            default_value: gcode.join('\n')
        };
    }

    addMachineEndGcodeArtisan(printMode, definition) {
        // ;--- End G-code Begin ---
        // M104 S0
        // M140 S0
        // G92 E0
        // G1 E-2 F3000
        // G92 E0
        // G28
        // ;--- End G-code End ---
        const gcode = [
            ';--- End G-code Begin ---',
            'M104 S0',
            'M140 S0',
            'G92 E0',
            'G1 E-2 F3000',
            'G92 E0',
            'G28',
            ';--- End G-code End ---',
        ];

        definition.settings.machine_end_gcode = {
            default_value: gcode.join('\n')
        };
    }

    // End Notice: only used for printing config
}

const definitionManager = new DefinitionManager();

// For debugging
window.definitionManager = definitionManager;

export default definitionManager;
