/* eslint-disable no-console */
/**
 * Unit tests for the MCP server's PURE modules - the ones with no server
 * imports (validator, envelopeChecks, positionOfRecord, machinePosition, ...).
 *
 *     npm run test:mcp
 *
 * runs this file under ts-node --transpile-only (see package.json). Each
 * *.test.ts exports `tests`: an array of [name, fn] pairs using node's
 * assert. No framework on purpose: the repo's only other runner is tape over
 * legacy JS, and these modules must stay importable without the Luban
 * server (config/settings.base is ESM-only and breaks ts-node).
 */
import { tests as connectionDiagnosticsTests } from './connectionDiagnostics.test';
import { tests as sstpConnectionTests } from './sstpConnection.test';
import { tests as bootstrapPlanTests } from './bootstrapPlan.test';
import { tests as camLinksTests } from './camLinks.test';
import { tests as cameraGeometryTests } from './cameraGeometry.test';
import { tests as cameraModelTests } from './cameraModel.test';
import { tests as cameraSelectionTests } from './cameraSelection.test';
import { tests as cornerFitTests } from './cornerFit.test';
import { tests as directMovePlanTests } from './directMovePlan.test';
import { tests as envelopeChecksTests } from './envelopeChecks.test';
import { tests as gpioFeedTests } from './gpioFeed.test';
import { tests as frameRecoveryTests } from './frameRecovery.test';
import { tests as inspectionReportTests } from './inspectionReport.test';
import { tests as jobDashboardTests } from './jobDashboard.test';
import { tests as jobEndingTests } from './jobEnding.test';
import { tests as landmarkClearanceTests } from './landmarkClearance.test';
import { tests as machinePositionTests } from './machinePosition.test';
import { tests as machineTravelTests } from './machineTravel.test';
import { tests as marchCoreTests } from './marchCore.test';
import { tests as mcpHealthTests } from './mcpHealth.test';
import { tests as mcpListenersTests } from './mcpListeners.test';
import { tests as mjpegFanoutTests } from './mjpegFanout.test';
import { tests as perimeterAnalysisTests } from './perimeterAnalysis.test';
import { tests as perimeterTraceTests } from './perimeterTrace.test';
import { tests as probeInspectionTests } from './probeInspection.test';
import { tests as probeFeedHealthTests } from './probeFeedHealth.test';
import { tests as procedureLimitsTests } from './procedureLimits.test';
import { tests as programEnvelopeTests } from './programEnvelope.test';
import { tests as programOpsTests } from './programOps.test';
import { tests as rotaryMotionTests } from './rotaryMotion.test';
import { tests as surveyMosaicTests } from './surveyMosaic.test';
import { tests as surveyPlanTests } from './surveyPlan.test';
import { tests as toolProtrusionTests } from './toolProtrusion.test';
import { tests as traversePlanTests } from './traversePlan.test';
import { tests as threadMillingTests } from './threadMilling.test';
import { tests as workspaceTests } from './workspace.test';
import { tests as validatorTests } from './validator.test';
import { tests as wallClearanceTests } from './wallClearance.test';
import { tests as wallFollowTests } from './wallFollow.test';
import { tests as audioSelectionTests } from './audioSelection.test';
import { tests as executionModelTests } from './executionModel.test';
import { tests as spindleProgramTests } from './spindleProgram.test';
import { tests as spindleTrackerTests } from './spindleTracker.test';
import { tests as telemetryConfigTests } from './telemetryConfig.test';
import { tests as telemetryRingTests } from './telemetryRing.test';

type TestCase = [string, () => void | Promise<void>];

const suites: Array<[string, TestCase[]]> = [
    ['sstpConnection', sstpConnectionTests],
    ['connectionDiagnostics', connectionDiagnosticsTests],
    ['validator', validatorTests],
    ['workspace', workspaceTests],
    ['threadMilling', threadMillingTests],
    ['machinePosition', machinePositionTests],
    ['machineTravel', machineTravelTests],
    ['envelopeChecks', envelopeChecksTests],
    ['cameraModel', cameraModelTests],
    ['cameraGeometry', cameraGeometryTests],
    ['cameraSelection', cameraSelectionTests],
    ['bootstrapPlan', bootstrapPlanTests],
    ['frameRecovery', frameRecoveryTests],
    ['probeFeedHealth', probeFeedHealthTests],
    ['gpioFeed', gpioFeedTests],
    ['probeInspection', probeInspectionTests],
    ['procedureLimits', procedureLimitsTests],
    ['programOps', programOpsTests],
    ['programEnvelope', programEnvelopeTests],
    ['rotaryMotion', rotaryMotionTests],
    ['surveyMosaic', surveyMosaicTests],
    ['surveyPlan', surveyPlanTests],
    ['toolProtrusion', toolProtrusionTests],
    ['traversePlan', traversePlanTests],
    ['directMovePlan', directMovePlanTests],
    ['jobEnding', jobEndingTests],
    ['jobDashboard', jobDashboardTests],
    ['landmarkClearance', landmarkClearanceTests],
    ['mjpegFanout', mjpegFanoutTests],
    ['mcpListeners', mcpListenersTests],
    ['mcpHealth', mcpHealthTests],
    ['marchCore', marchCoreTests],
    ['camLinks', camLinksTests],
    ['wallClearance', wallClearanceTests],
    ['inspectionReport', inspectionReportTests],
    ['wallFollow', wallFollowTests],
    ['cornerFit', cornerFitTests],
    ['perimeterAnalysis', perimeterAnalysisTests],
    ['perimeterTrace', perimeterTraceTests],
    ['telemetryRing', telemetryRingTests],
    ['telemetryConfig', telemetryConfigTests],
    ['spindleProgram', spindleProgramTests],
    ['spindleTracker', spindleTrackerTests],
    ['audioSelection', audioSelectionTests],
    ['executionModel', executionModelTests],
];

async function main(): Promise<void> {
    let passed = 0;
    let failed = 0;
    for (const [suite, cases] of suites) {
        for (const [name, fn] of cases) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await fn();
                passed += 1;
                console.log(`  ok    ${suite} :: ${name}`);
            } catch (err) {
                failed += 1;
                console.log(`  FAIL  ${suite} :: ${name}`);
                console.log(`        ${(err as Error).message.split('\n').join('\n        ')}`);
            }
        }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
}

main();
