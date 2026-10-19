// connectedMachine.ts's toolhead functions over a test's OWN machine state and
// dialect row, for the vm-loaded tool modules whose '../connectedMachine' is
// stubbed (the real one reads the live ConnectionManager). The judgement is the
// real toolheadState.ts, so a stub refuses exactly where the tool would.
import { GcodeDialect } from '../../gcodeDialect';
import { HeadReadings, ToolheadAssessment, assessToolhead, getMcpLaserRecord, toolheadNote, toolheadOnRefusal } from '../../toolheadState';

export const TEST_CONNECTION = 'test-connection';

export function toolheadStubs(readState: () => HeadReadings | null, dialect: GcodeDialect,
    ToolError: new (message: string) => Error = Error) {
    const connectedToolhead = () => assessToolhead(dialect, readState());
    return {
        connectedToolhead,
        assertToolheadNotOn: (message: string): ToolheadAssessment => {
            const assessment = connectedToolhead();
            const refusal = toolheadOnRefusal(assessment, message);
            if (refusal) {
                throw new ToolError(refusal);
            }
            return assessment;
        },
        connectedConnectionId: () => TEST_CONNECTION,
        connectedLaserRecord: () => getMcpLaserRecord(TEST_CONNECTION),
        connectedToolheadNote: (assessment: ToolheadAssessment = connectedToolhead(), laserOffSent: string | null = null) => toolheadNote(
            assessment, getMcpLaserRecord(TEST_CONNECTION), laserOffSent,
        ),
    };
}
