import logger from '../../lib/logger';
import { clearActiveTool, describeActiveTool, setActiveTool } from './activeTool';
import { currentToolProtrusion } from './clearanceContext';
import { CLEARANCE_MARGIN_MM } from './landmarkClearance';
import { landmarkStore } from './landmarks';

const log = logger('service:mcp:pendant');

export function pendantSettings() {
    return { activeTool: describeActiveTool(),
        toolProtrusion: currentToolProtrusion(),
        clearanceMarginMm: CLEARANCE_MARGIN_MM,
        landmarks: landmarkStore.list() };
}

/** Called only behind the local operator-page token and exclusive, disarmed gate. */
export function updatePendantSettings(args: Record<string, unknown>): void {
    switch (args.kind) {
        case 'tool': {
            if (typeof args.protrusionMm !== 'number' || !Number.isFinite(args.protrusionMm) || args.protrusionMm <= 0) {
                throw new Error('Fitted-tool protrusion must be a positive number in mm.');
            }
            const before = describeActiveTool();
            const after = setActiveTool({ protrusionMm: args.protrusionMm,
                source: 'operator',
                toolIdentity: String(args.toolIdentity || '').trim(),
                note: String(args.note || 'Confirmed by the operator on the local pendant page.').trim() });
            log.info(`Operator confirmed fitted tool: ${JSON.stringify({ before, after })}`);
            return;
        }
        case 'clear-tool': {
            const before = describeActiveTool();
            clearActiveTool();
            log.info(`Operator selected conservative tool fallback: ${JSON.stringify(before)}`);
            return;
        }
        case 'obstacle': {
            const name = String(args.name || '').trim();
            const description = String(args.description || '').trim();
            if (!name || !description) { throw new Error('Obstruction name and description are required.'); }
            const coordinates = [args.x0, args.y0, args.x1, args.y1];
            if (coordinates.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
                throw new Error('Obstruction XY bounds must be finite machine coordinates.');
            }
            const [x0, y0, x1, y1] = coordinates as number[];
            if (x0 >= x1 || y0 >= y1) { throw new Error('Obstruction bounds require X min < max and Y min < max.'); }
            if (args.clearanceBasis !== 'physical' && args.clearanceBasis !== 'toolhead') {
                throw new Error('Choose physical obstacle top or minimum toolhead Z.');
            }
            if (typeof args.enabled !== 'boolean') { throw new Error('State whether this landmark is an obstruction.'); }
            if (args.enabled && (typeof args.clearanceZ !== 'number' || !Number.isFinite(args.clearanceZ))) {
                throw new Error('Obstruction height must be a finite machine Z.');
            }
            const existing = args.id ? landmarkStore.list().find((item) => item.id === args.id) : undefined;
            if (args.id && !existing) { throw new Error('This obstruction changed. Reload the settings before editing it.'); }
            if (landmarkStore.list().some((item) => item.name === name && item.id !== existing?.id)) {
                throw new Error('That name already exists. Select the existing obstruction to edit it.');
            }
            const after = landmarkStore.add({ name,
                description,
                machine: { x0, y0, x1, y1 },
                clearanceZ: args.enabled ? args.clearanceZ as number : null,
                clearanceBasis: args.clearanceBasis,
                notes: String(args.notes || 'Operator updated on the local pendant page.').trim() });
            if (existing && existing.name !== name) { landmarkStore.remove(existing.id); }
            log.info(`Operator updated obstruction: ${JSON.stringify({ before: existing || null, after })}`);
            return;
        }
        case 'remove-obstacle': {
            const existing = landmarkStore.list().find((item) => item.id === args.id);
            if (!existing) { throw new Error('Select an existing obstruction; reload if it changed.'); }
            landmarkStore.remove(existing.id);
            log.info(`Operator removed obstruction: ${JSON.stringify(existing)}`);
            return;
        }
        default: throw new Error('Unknown pendant settings action.');
    }
}
