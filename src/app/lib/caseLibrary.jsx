import {
    isDualExtruder,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
} from '../constants/machines';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine
} from '../machines';
import { L20WLaserToolModule, L40WLaserToolModule } from '../machines/snapmaker-2-toolheads';

import {
    CaseConfigA150CncStandard,
    CaseConfigA150LaserPowerOne,
    CaseConfigA150LaserPowerTwo,
    CaseConfigA150PrintingSingle,
    CaseConfigA250CncFourAxis,
    CaseConfigA250CncStandard,
    CaseConfigA250LaserFourAxis,
    CaseConfigA250LaserPowerOne,
    CaseConfigA250LaserPowerTwo,
    CaseConfigA250PrintingSingle,
    CaseConfigA350CncFourAxis,
    CaseConfigA350CncStandard,
    CaseConfigA350LaserFourAxis,
    CaseConfigA350LaserPowerOne,
    CaseConfigA350LaserPowerTwo,
    CaseConfigA350PrintingSingle,
    CaseConfigLubanLock,
    CaseConfigGimbal,
    CaseConfigSM2Gimbal,
    CaseConfigOriginalCncStandard,
    CaseConfigOriginalLaserPowerOne,
    CaseConfigOriginalLaserPowerTwo,
    CaseConfigOriginalPrintingSingle,
    CaseConfigPenHolder,
    getLaserCaseConfigFor20WModule,
    getLaserCaseConfigFor40WModule,
} from '../ui/pages/HomePage/CaseConfig';

export const getCaseList = (series, toolHead) => {
    const { printingToolhead, laserToolhead, cncToolhead } = toolHead;
    let caseList = [];
    let caseListFourAxis = [];

    const isDual = isDualExtruder(printingToolhead);

    switch (series) {
        case SnapmakerOriginalMachine.identifier:
        case SnapmakerOriginalExtendedMachine.identifier:
            caseList = CaseConfigOriginalPrintingSingle;
            if (laserToolhead === LEVEL_ONE_POWER_LASER_FOR_ORIGINAL) {
                caseList = caseList.concat(CaseConfigOriginalLaserPowerOne);
            }
            if (laserToolhead === LEVEL_TWO_POWER_LASER_FOR_ORIGINAL) {
                caseList = caseList.concat(CaseConfigOriginalLaserPowerTwo);
            }
            caseList = caseList.concat(CaseConfigOriginalCncStandard);
            break;
        case SnapmakerA150Machine.identifier:
            if (!isDual) {
                caseList = caseList.concat(CaseConfigA150PrintingSingle);
            }
            if (isDual) {
                caseList.push(CaseConfigSM2Gimbal);
            }
            if (laserToolhead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA150LaserPowerOne);
            }
            if (laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA150LaserPowerTwo);
            }
            caseList = caseList.concat(CaseConfigA150CncStandard);
            break;
        case SnapmakerA250Machine.identifier:
            if (!isDual) {
                caseList = caseList.concat(CaseConfigA250PrintingSingle);
            }
            if (isDual) {
                caseList.push(CaseConfigSM2Gimbal);
            }
            if (laserToolhead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA250LaserPowerOne);
            }
            if (laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA250LaserPowerTwo);
            }
            caseList = caseList.concat(CaseConfigA250CncStandard);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA250CncFourAxis);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA250LaserFourAxis);
            break;
        case SnapmakerA350Machine.identifier:
            if (!isDual) {
                caseList = caseList.concat(CaseConfigA350PrintingSingle);
            }
            if (isDual) {
                caseList.push(CaseConfigSM2Gimbal);
            }
            if (laserToolhead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA350LaserPowerOne);
            }
            if (laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA350LaserPowerTwo);
            }
            caseList = caseList.concat(CaseConfigA350CncStandard);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA350CncFourAxis);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA350LaserFourAxis);
            break;
        case SnapmakerArtisanMachine.identifier: {
            if (!isDual) {
                caseList = caseList.concat(CaseConfigA350PrintingSingle);
            }
            if (isDual) {
                caseList.push(CaseConfigPenHolder);
            }
            // Reuse laser and CNC projects
            if (laserToolhead === LEVEL_ONE_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA350LaserPowerOne);
            }
            if (laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                caseList = caseList.concat(CaseConfigA350LaserPowerTwo);
            }
            if (cncToolhead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2) {
                caseList.push(CaseConfigLubanLock);
            }
            caseList = caseList.concat(CaseConfigA350CncStandard);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA350CncFourAxis);
            caseListFourAxis = caseListFourAxis.concat(CaseConfigA350LaserFourAxis);

            break;
        }
        case SnapmakerJ1Machine.identifier: {
            caseList.push(CaseConfigGimbal);
            caseList.push(CaseConfigPenHolder);
            break;
        }
        default:
            break;
    }

    // 20W & 40W
    switch (laserToolhead) {
        case L20WLaserToolModule.identifier:
            caseList = caseList.concat(getLaserCaseConfigFor20WModule());
            break;
        case L40WLaserToolModule.identifier:
            caseList = caseList.concat(getLaserCaseConfigFor40WModule());
            break;
        default:
            break;
    }

    return {
        caseList,
        caseListFourAxis
    };
};
