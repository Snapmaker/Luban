import events from 'events';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { generateRandomPathName } from '../../shared/lib/random-utils';
import settings from '../config/settings';
import { PRINTING_CONFIG_SUBCATEGORY } from '../constants';
import { DefinitionLoader } from './definition';
import { Metadata, SliceResult } from './slicer-definitions';

/**
 * G-code post-processor (version: 0).
 */
export function processGcodeHeaderAfterCuraEngine(gcodeFilePath: string, metadata: Metadata, sliceResult: SliceResult): number {
    const activeFinal = new DefinitionLoader();
    activeFinal.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'active_final', null);
    const extruderCount = activeFinal?.settings?.extruders_enabled_count?.default_value;
    const isDualExtruder = extruderCount === 2;

    const extruderL = new DefinitionLoader();
    extruderL.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_0', null);

    let extruderR = null;
    if (isDualExtruder) {
        extruderR = new DefinitionLoader();
        extruderR.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_1', null);
    }

    const readFileSync = fs.readFileSync(gcodeFilePath, 'utf8');

    const date = new Date();
    const splitIndex = readFileSync.indexOf(';Generated');
    const boundingBoxMax = metadata.boundingBox ? metadata.boundingBox.max : { x: 0, y: 0, z: 0 };
    const boundingBoxMin = metadata.boundingBox ? metadata.boundingBox.min : { x: 0, y: 0, z: 0 };

    let filamentWeight = '';
    let filamentLength = '';
    if (sliceResult.filamentWeight) {
        filamentWeight = `${sliceResult.filamentWeight.reduce((a, b) => a + b, 0)}`;
    }
    if (sliceResult.filamentLength) {
        filamentLength = `${sliceResult.filamentLength.reduce((a, b) => a + b, 0)}`;
    }

    const headerCodes = [
        ';Header Start',
        '',
        `${readFileSync.substring(0, splitIndex)}`,
        ';header_type: 3dp',
        `;tool_head: ${metadata?.printingToolhead}`,
        `;machine: ${metadata?.series}`,
        `;thumbnail: ${metadata.thumbnail}`,
        `;file_total_lines: ${readFileSync.split('\n').length + 20}`,
        `;estimated_time(s): ${sliceResult.printTime}`,
    ];

    if (extruderL) {
        const temp0 = extruderL.settings.material_print_temperature_layer_0.default_value;
        const nozzleSize = extruderL.settings.machine_nozzle_size.default_value;

        headerCodes.push(`;nozzle_temperature(°C): ${temp0}`);
        headerCodes.push(`;nozzle_0_diameter(mm): ${nozzleSize}`);
        headerCodes.push(`;Extruder 0 Retraction Distance:${extruderL.settings.retraction_amount.default_value}`);
        headerCodes.push(`;Extruder 0 Switch Retraction Distance:${extruderL.settings.switch_extruder_retraction_amount.default_value}`);
    }

    if (extruderR) {
        const temp0 = extruderR.settings.material_print_temperature_layer_0.default_value;
        const nozzleSize = extruderR.settings.machine_nozzle_size.default_value;

        headerCodes.push(`;nozzle_1_temperature(°C): ${temp0}`);
        headerCodes.push(`;nozzle_1_diameter(mm): ${nozzleSize}`);
        headerCodes.push(`;Extruder 1 Retraction Distance:${extruderR.settings.retraction_amount.default_value}`);
        headerCodes.push(`;Extruder 1 Switch Retraction Distance:${extruderR.settings.switch_extruder_retraction_amount.default_value}`);
    } else {
        headerCodes.push(';nozzle_1_temperature(°C): -1');
        headerCodes.push(';nozzle_1_diameter(mm): -1');
    }

    headerCodes.push(
        `;build_plate_temperature(°C): ${activeFinal.settings.material_bed_temperature_layer_0.default_value}`,
        `;work_speed(mm/minute): ${activeFinal.settings.speed_infill.default_value * 60}`,
        `;max_x(mm): ${boundingBoxMax.x}`,
        `;max_y(mm): ${boundingBoxMax.y}`,
        `;max_z(mm): ${boundingBoxMax.z}`,
        `;min_x(mm): ${boundingBoxMin.x}`,
        `;min_y(mm): ${boundingBoxMin.y}`,
        `;min_z(mm): ${boundingBoxMin.z}`,
        `;layer_number: ${metadata?.layerCount}`,
        `;layer_height: ${activeFinal.settings.layer_height.default_value}`,
        `;matierial_weight: ${filamentWeight}`,
        `;matierial_length: ${filamentLength}`,
        `;nozzle_0_material: ${metadata?.material0}`,
        `;nozzle_1_material: ${metadata?.material1}`,
        ';Header End',
        '',
        `;Snapmaker Luban ${settings.version}`,
        `;${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`,
        '',
    );

    const header = headerCodes.join('\n');

    const nextSplitIndex = readFileSync.indexOf('\n', splitIndex) + 1;

    const dataLength = header.length + readFileSync.length - nextSplitIndex;
    fs.writeFileSync(gcodeFilePath, header + readFileSync.substring(nextSplitIndex));
    return dataLength;
}

/**
 * G-code post-processor.
 *
 * version = 1
 *
 */
export async function postProcessorV1(sliceResult: SliceResult, metadata: Metadata): Promise<void> {
    const filePath = sliceResult.gcodeFilePath;


    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, 'utf8'),
        crlfDelay: Infinity,
    });

    let totalLineCount = 0;
    let checkHeaderLines = true;
    for await (const line of rl) {
        if (checkHeaderLines) {
            if (line.startsWith(';Generated with')) {
                checkHeaderLines = false;
            }

            if (!sliceResult.printTime && line.startsWith(';TIME:')) {
                const eta = Number(line.replace(';TIME:', ''));
                sliceResult.printTime = Math.round(eta);
            }
        } else {
            totalLineCount++;
        }
    }

    // Generate final
    const activeFinal = new DefinitionLoader();
    activeFinal.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'active_final', null);
    const extruderL = new DefinitionLoader();
    extruderL.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_0', null);
    const extruderR = new DefinitionLoader();
    extruderR.loadDefinition(PRINTING_CONFIG_SUBCATEGORY, 'snapmaker_extruder_1', null);

    const date = new Date();
    const boundingBoxMax = metadata.boundingBox ? metadata.boundingBox.max : { x: 0, y: 0, z: 0 };
    const boundingBoxMin = metadata.boundingBox ? metadata.boundingBox.min : { x: 0, y: 0, z: 0 };

    const headerCodes = [
        ';Header Start',
        ';Version:1',
        ';Slicer:LunarSlicer',
        `;Printer:${metadata.series}`,
        `;Estimated Print Time:${sliceResult.printTime}`,
        `;Lines:${totalLineCount}`, // not including headers
        `;Extruder Mode:${metadata.printMode}`,
    ];

    if (extruderL) {
        headerCodes.push(`;Extruder 0 Nozzle Size:${extruderL.settings.machine_nozzle_size.default_value}`);
        headerCodes.push(`;Extruder 0 Material:${metadata.material0}`);
        headerCodes.push(`;Extruder 0 Print Temperature:${extruderL.settings.material_print_temperature_layer_0.default_value}`);
        headerCodes.push(`;Extruder 0 Retraction Distance:${extruderL.settings.retraction_amount.default_value}`);
        headerCodes.push(`;Extruder 0 Switch Retraction Distance:${extruderL.settings.switch_extruder_retraction_amount.default_value}`);
    }

    if (extruderR) {
        headerCodes.push(`;Extruder 1 Nozzle Size:${extruderR.settings.machine_nozzle_size.default_value}`);
        headerCodes.push(`;Extruder 1 Material:${metadata.material1}`);
        headerCodes.push(`;Extruder 1 Print Temperature:${extruderR.settings.material_print_temperature_layer_0.default_value}`);
        headerCodes.push(`;Extruder 1 Retraction Distance:${extruderR.settings.retraction_amount.default_value}`);
        headerCodes.push(`;Extruder 1 Switch Retraction Distance:${extruderR.settings.switch_extruder_retraction_amount.default_value}`);
    }

    headerCodes.push(`;Bed Temperature:${activeFinal.settings.material_bed_temperature_layer_0.default_value}`);

    const isDual = activeFinal.settings.extruders_enabled_count.default_value;
    const isDefaultPrintMode = metadata.printMode === 'Default';

    headerCodes.push(`;Extruder(s) Used:${isDual && isDefaultPrintMode ? 2 : 1}`);

    headerCodes.push(`;Work Range - Min X:${boundingBoxMin.x}`);
    headerCodes.push(`;Work Range - Min Y:${boundingBoxMin.y}`);
    headerCodes.push(`;Work Range - Min Z:${boundingBoxMin.z}`);
    headerCodes.push(`;Work Range - Max X:${boundingBoxMax.x}`);
    headerCodes.push(`;Work Range - Max Y:${boundingBoxMax.y}`);
    headerCodes.push(`;Work Range - Max Z:${boundingBoxMax.z}`);

    headerCodes.push(`;Thumbnail:${metadata.thumbnail}`);
    headerCodes.push(';Header End');
    headerCodes.push(`;Snapmaker Luban ${settings.version}`);
    headerCodes.push(`;${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`);
    headerCodes.push('');

    // write G-code to a new file
    const dirPath = path.dirname(filePath);
    const newFilename = generateRandomPathName('abc.gcode');
    const newFilePath = path.join(dirPath, newFilename);
    sliceResult.gcodeFilename = newFilename;
    sliceResult.gcodeFilePath = newFilePath;

    const outputStream = fs.createWriteStream(newFilePath, 'utf8');
    const header = headerCodes.join('\n');
    outputStream.write(header);
    const rl2 = readline.createInterface({
        input: fs.createReadStream(filePath, 'utf8'),
        crlfDelay: Infinity,
    });
    checkHeaderLines = true;

    rl2.on('line', (line) => {
        if (checkHeaderLines) {
            if (line.startsWith(';Generated with')) {
                checkHeaderLines = false;
            }
        } else {
            outputStream.write(`${line}\n`);
        }
    });

    await events.once(rl2, 'close');

    await new Promise<void>((resolve) => {
        outputStream.close(() => resolve());
    });
}
