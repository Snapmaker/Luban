// connectedMachine.ts's toolhead functions over a test's OWN machine state and
// dialect row, for the vm-loaded tool modules whose '../connectedMachine' is
// stubbed (the real one reads the live ConnectionManager). The judgement is the
// real toolheadState.ts, so a stub refuses exactly where the tool would.
import { GcodeDialect } from '../../gcodeDialect';
import { MotorPowerReading, motorPowerNote, motorPowerRefusal, readMotorPower } from '../../motorPower';
import { HeadReadings, ToolheadAssessment, assessToolhead, getMcpLaserRecord, toolheadNote, toolheadOnRefusal } from '../../toolheadState';

export const TEST_CONNECTION = 'test-connection';

/**
 * `readMotorPower` is the channel's getMotorPowerMode for a dialect row with a
 * motor-power mode (the Ray); omitted, the Ray reads 'unknown' (no reader) and
 * refuses, exactly as a Ray channel without the read would. On a row without
 * the mode nothing is read and nothing gated, as connectedMachine.ts does.
 */
export function toolheadStubs(readState: () => HeadReadings | null, dialect: GcodeDialect,
    ToolError: new (message: string) => Error = Error, readMotorPowerMode: (() => Promise<unknown>) | null = null) {
    const connectedMotorPower = async (): Promise<MotorPowerReading | null> => (
        dialect.motorPower.read === 'none' ? null : readMotorPower(readMotorPowerMode)
    );
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
        connectedMotorPower,
        assertMotorPowered: async (action: string, after: string): Promise<MotorPowerReading | null> => {
            const reading = await connectedMotorPower();
            const refusal = reading ? motorPowerRefusal(reading, action, '(test machine)', after) : null;
            if (refusal) {
                throw new ToolError(refusal);
            }
            return reading;
        },
        connectedMotorPowerNote: (reading: MotorPowerReading | null) => (reading ? motorPowerNote(reading, dialect.motorPower.basis) : null),
        connectedConnectionId: () => TEST_CONNECTION,
        connectedLaserRecord: () => getMcpLaserRecord(TEST_CONNECTION),
        connectedToolheadNote: (assessment: ToolheadAssessment = connectedToolhead(), laserOffSent: string | null = null) => toolheadNote(
            assessment, getMcpLaserRecord(TEST_CONNECTION), laserOffSent,
        ),
    };
}
