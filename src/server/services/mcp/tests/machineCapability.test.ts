import { strict as assert } from 'assert';

import {
    G28_HOME_SEQUENCE,
    GRBL_HOME,
    LEGACY_MACHINE_IDENTIFIER,
    RAY_IDENTIFIER,
    appliesToMachine,
    deriveMachineCapability,
    homeCommandFor,
    isLegacyScope,
    machineTag,
    recordMachineScope,
    summariseMachine,
} from '../machineCapability';

// The two machines as their Luban definitions describe them
// (src/app/machines/snapmaker-ray.ts, snapmaker-2.0-a350.ts).
const RAY = { identifier: 'Ray', machineType: 'Laser', metadata: { size: { x: 600, y: 400, z: 0 } } };
const A350 = { identifier: 'Snapmaker 2.0 A350', machineType: 'Multi-function 3D Printer', metadata: { size: { x: 320, y: 350, z: 330 } } };

export const tests: Array<[string, () => void]> = [
    ['the Ray has no Z axis: its definition says size.z 0, and that is the whole truth of it', () => {
        const cap = deriveMachineCapability(RAY);
        assert.equal(cap.hasZ, false);
        assert.equal(cap.known, true);
        assert.equal(cap.type, 'Laser');
        assert.deepEqual(summariseMachine(cap), { identifier: 'Ray', type: 'Laser', hasZ: false, dialect: 'ray-grbl' });
        assert.equal(machineTag(cap), '(connected machine: Ray, Laser, no Z axis)');
    }],

    ['the A350 has a Z axis, as every law assumed until now', () => {
        const cap = deriveMachineCapability(A350);
        assert.equal(cap.hasZ, true);
        assert.deepEqual(cap.size, { x: 320, y: 350, z: 330 });
        assert.equal(machineTag(cap), '(connected machine: Snapmaker 2.0 A350, Multi-function 3D Printer, has a Z axis)');
    }],

    ['an unknown machine is assumed to HAVE Z: the Z laws stay in force until the profile says otherwise', () => {
        const cap = deriveMachineCapability(null, 'Some Future Machine');
        assert.equal(cap.hasZ, true);
        assert.equal(cap.known, false);
        assert.equal(cap.identifier, 'Some Future Machine');
        assert.equal(cap.size, null);
        assert.equal(machineTag(deriveMachineCapability(null, null)), '(no machine connected)');
    }],

    // Machine scoping of stored records (landmarks, calibrations, stated travel).
    ['a record with no machine tag belongs to the A350 - the only machine it could have been set on', () => {
        assert.equal(LEGACY_MACHINE_IDENTIFIER, 'Snapmaker 2.0 A350');
        assert.equal(recordMachineScope(undefined), LEGACY_MACHINE_IDENTIFIER);
        assert.equal(recordMachineScope(''), LEGACY_MACHINE_IDENTIFIER);
        assert.equal(recordMachineScope('   '), LEGACY_MACHINE_IDENTIFIER);
        assert.equal(recordMachineScope('Ray'), 'Ray');
        assert.equal(isLegacyScope(undefined), true);
        assert.equal(isLegacyScope('Ray'), false);
    }],

    ['a legacy A350 record applies on the A350 exactly as before, and not on the Ray', () => {
        assert.equal(appliesToMachine(recordMachineScope(undefined), 'Snapmaker 2.0 A350'), true);
        assert.equal(appliesToMachine(recordMachineScope(undefined), 'Ray'), false);
        assert.equal(appliesToMachine('Ray', 'Ray'), true);
        assert.equal(appliesToMachine('Ray', 'Snapmaker 2.0 A350'), false);
    }],

    ['with no machine connected nothing applies - there is no motion to check', () => {
        assert.equal(appliesToMachine('Ray', null), false);
        assert.equal(appliesToMachine(LEGACY_MACHINE_IDENTIFIER, null), false);
    }],

    // Homing: the $H fix of fd3c8c7da, decided from transport + identity, never from a reply.
    ['the Ray over SACP homes on GRBL $H, as Luban\'s Home button does for it', () => {
        const command = homeCommandFor({ sacp: true, machineIdentifier: RAY_IDENTIFIER, canExecuteGcode: true, canGoHome: true });
        assert.equal(command.kind, 'grbl-home');
        assert.equal(command.gcode, GRBL_HOME);
        assert.equal(command.gcode, '$H');
        assert.match(command.reason, /never answers the SACP/);
    }],

    ['other SACP machines (Artisan, J1) keep the channel\'s own home request', () => {
        const command = homeCommandFor({ sacp: true, machineIdentifier: 'A400', canExecuteGcode: true, canGoHome: true });
        assert.equal(command.kind, 'sacp-home-request');
        assert.equal(command.gcode, null);
        assert.equal(command.label, 'SACP home request');
    }],

    ['the A350 over HTTP/serial keeps Luban\'s G53; G28; G54 sequence, byte for byte', () => {
        const command = homeCommandFor({ sacp: false, machineIdentifier: 'Snapmaker 2.0 A350', canExecuteGcode: true, canGoHome: false });
        assert.equal(command.kind, 'g28-sequence');
        assert.equal(command.gcode, G28_HOME_SEQUENCE);
        assert.equal(command.gcode, 'G53;\nG28;\nG54;');
        assert.equal(command.label, 'G28');
    }],

    ['a SACP channel without goHome, or a Ray channel without executeGcode, falls back to the gcode sequence', () => {
        assert.equal(homeCommandFor({ sacp: true, machineIdentifier: 'A400', canExecuteGcode: true, canGoHome: false }).kind, 'g28-sequence');
        assert.equal(homeCommandFor({ sacp: true, machineIdentifier: RAY_IDENTIFIER, canExecuteGcode: false, canGoHome: true }).kind, 'sacp-home-request');
    }],

    // The dialect table (gcodeDialect.ts, #265 WP1) rides on the capability.
    ['the capability carries the dialect row: the Ray speaks ray-grbl, the A350 sm2-marlin', () => {
        assert.equal(deriveMachineCapability(RAY).dialect.id, 'ray-grbl');
        const a350 = deriveMachineCapability(A350);
        assert.equal(a350.dialect.id, 'sm2-marlin');
        assert.equal(summariseMachine(a350).dialect, 'sm2-marlin');
    }],

    ['an unknown machine HAS Z for the laws but may not move Z: hasZ true, supports.zAxis false, dialect unknown', () => {
        const cap = deriveMachineCapability(null, 'Some Future Machine');
        assert.equal(cap.hasZ, true);
        assert.equal(cap.dialect.id, 'unknown');
        assert.equal(cap.supports.zAxis, false);
        assert.ok(Object.values(cap.supports).every((flag) => flag === false));
        assert.equal(summariseMachine(cap).dialect, 'unknown');
    }],

    ['a listed identifier without a definition still gets the unknown row - nothing is known about it', () => {
        assert.equal(deriveMachineCapability(null, 'Ray').dialect.id, 'unknown');
    }],
];
