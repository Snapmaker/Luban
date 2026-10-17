// The staging-time stylus-reach gate every -Z (or in-pocket) planner calls
// (issue #187): the pure verdict from stylusReach.ts against the stored
// geometry, mapped to the tool error the planner would throw itself. A
// refusal carries the numbers; 'reach-unknown' and 'rim-unknown' are
// returned for the plan to carry onto the confirm page and into the result.
import { McpToolError } from './registry';
import { stylusReachForPlan } from './rotaryGeometry';
import { RimArgs, StylusReachVerdict } from './stylusReach';

export function requireStylusReach(args: RimArgs, deepestZMachine: number, what: string): StylusReachVerdict {
    let verdict: StylusReachVerdict;
    try {
        verdict = stylusReachForPlan(args, deepestZMachine);
    } catch (err) {
        if ((err as Error).name === 'RimArgError') {
            throw new McpToolError((err as Error).message);
        }
        throw err;
    }
    if (verdict.status === 'refused') {
        throw new McpToolError(`${what} refused (stylus reach, issue #187): ${verdict.note}`);
    }
    return verdict;
}

/** The three rim arguments every planner's schema exposes. */
export const RIM_ARG_SCHEMA = {
    rim_z_machine: {
        type: 'number',
        description: 'When probing INSIDE a pocket or below a rim: the toolhead machine Z at which the tip touches the highest '
            + 'surface under the probe BODY (the rim the body would land on) - measured or operator-stated. With a stored '
            + 'probe_stylus_exposed_mm the plan is REFUSED at staging if its deepest contact lies more than reach - ball - '
            + 'reach_margin_mm below it; with no stored reach the result and confirm page say "stylus reach unknown: body '
            + 'collision not checked". In a probe_program this may be a bounded reference to an earlier top touch.',
    },
    surface_z_machine: { type: 'number', description: 'Alias of rim_z_machine (the same quantity); state one.' },
    reach_margin_mm: { type: 'number', description: 'Air kept between the body shoulder and the rim, default 2 (0-10).' },
} as const;
