import React, { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { HEAD_LASER, PAGE_PROCESS } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine
} from '../../../machines';
import Steps from '../../components/Steps';
import {
    laser4AxisStepOne,
    laserCncIntroStepFive,
    laserCncIntroStepOne,
    laserCncIntroStepSix,
    laserCncIntroStepTwo
} from '../introContent';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';


type TooltipPosition = 'top' | 'right' | 'bottom' | 'left' |
    'bottom-left-aligned' |
    'bottom-middle-aligned' |
    'bottom-right-aligned' |
    'top-left-aligned' |
    'top-middle-aligned' |
    'top-right-aligned' |
    'auto';


interface StepItem {
    intro: React.ReactNode;
    title: string;
    position?: TooltipPosition;
    element?: string;
    tooltipClass?: string;
    highlightClass?: string;
    disableInteraction?: boolean;
}


const getSteps = (series: string, isRotate: boolean): StepItem[] => {
    const steps: StepItem[] = [
        {
            intro: isRotate ? laser4AxisStepOne(
                i18n._('key-Laser/Page-Set the work size and where the work origin will be.'),
                i18n._('key-Laser/Page-D is the diameter of the material,  and L is the length of the material.'),
                i18n._('key-Laser/Page-Origin is fixed at the edge of the cross-section of the cylinder, far way from the chuck.')
            ) : laserCncIntroStepOne(
                i18n._('key-Laser/Page-Set the work size and where the work origin will be.'),
                i18n._('key-Laser/Page-X is the width of the material,  and Y is the height of the material.'),
                i18n._('There are two types of origin mode.'),
                i18n._('In object origin mode, the origin is at the corners or center of the object.'),
                i18n._('In workpiece origin mode, the origin is at the corners or center of the workpiece.'),
                i18n._('This point (X0, Y0) is the origin of the design coordinate system, and the origin to be positioned or set on the machine needs to coincide with this point.'),
                i18n._('There are two types of origin offset modes: crosshair mode and low light mode. In most cases we recommend using the crosshair mode, it is safer and easier to use. The laser point mode is only recommended when full-stroke machining is required.')
            ),
            title: `${i18n._('key-Laser/Page-Job Setup')} (1/8)`
        },
        {
            element: '.laser-tool-bar-open-icon',
            title: `${i18n._('key-Laser/Page-Import Object')} (2/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Import an object, or drag an object to Luban.')),
            disableInteraction: true,
            tooltipClass: 'laser-import-intro',
            position: 'right'
        },
        {
            element: '.laser-draw-intro-part',
            title: `${i18n._('key-Laser/Page-Draw Object')} (3/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
            disableInteraction: true,
            tooltipClass: 'laser-draw-intro',
            position: 'right'
        },
        {
            // element: '.laser-intro-edit-panel',
            element: '.widget-list-intro',
            title: `${i18n._('key-Laser/Page-Edit Panel')} (4/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
            disableInteraction: true,
            tooltipClass: 'laser-edit-panel-intro',
            position: 'left'
        },
        {
            element: '.widget-list-intro',
            title: `${i18n._('key-Laser/Page-Process Panel')} (5/8)`,
            intro: laserCncIntroStepFive(
                i18n._('key-Laser/Page-The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                i18n._('key-Laser/Page-After the selected object is edited, click Create Toolpath to create a toolpath of the object. Below the Toolpath List are the parameters you often use.'),
                i18n._('key-Laser/Page-Create Toolpath')
            ),
            disableInteraction: true,
            position: 'left'
        },
        {
            element: '.laser-preview-export-intro-part',
            title: `${i18n._('key-Laser/Page-Generate G-code and Preview')} (6/8)`,
            position: 'top',
            disableInteraction: true,
            intro: laserCncIntroStepSix(
                i18n._('key-Laser/Page-Click to generate and preview the G-code file.'),
                i18n._('For laser engraving, you can preview the toolpath.'),
                // isRotate ? '/resources/images/guide-tours/laser_4_axis_priview.png' : '/resources/images/guide-tours/laser_3_axis_priview.png'
                isRotate,
                series,
                'laser'
            )
        },
        {
            element: '.laser-preview-export-intro-part',
            title: `${i18n._('key-Laser/Page-Export')} (7/8)`,
            position: 'top',
            disableInteraction: true,
            intro: laserCncIntroStepTwo(
                i18n._('Export the G-code file to a local device or load it to Workspace.')
            )
        },
        {
            element: '.cnc-laser-save-icon',
            title: `${i18n._('key-Laser/Page-Save Project')} (8/8)`,
            position: 'bottom',
            disableInteraction: true,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Save the project to a local device for reuse.'))
        }
    ];

    return steps;
};


const getShowCaseProject = (machineIdentifier: string, toolHeadIdentifier: string, isRotate: boolean = false) => {
    let pathConfig = {};
    if (isRotate) {
        if (toolHeadIdentifier === L20WLaserToolModule.identifier) {
            pathConfig = {
                path: './UserCase/laser/20w_laser_module/guide-4axis.snaplzr',
                name: 'guide-4axis.snaplzr'
            };
            return pathConfig;
        } else if (toolHeadIdentifier === L40WLaserToolModule.identifier) {
            // yes use 20w guide
            pathConfig = {
                path: './UserCase/laser/20w_laser_module/guide-4axis.snaplzr',
                name: 'guide-4axis.snaplzr'
            };
            return pathConfig;
        }

        switch (machineIdentifier) {
            case SnapmakerA250Machine.identifier:
                pathConfig = {
                    path: './UserCase/laser/a250_1600mw/laser_4th_a250a350_1600mW.snaplzr',
                    name: 'laser_4th_a250a350_1600mW.snaplzr'
                };
                break;
            default:
                pathConfig = {
                    path: './UserCase/laser/a350_1600mw/laser_4th_a250a350_1600mW.snaplzr',
                    name: 'laser_4th_a250a350_1600mW.snaplzr'
                };
                break;
        }
    } else {
        switch (toolHeadIdentifier) {
            case L20WLaserToolModule.identifier: {
                pathConfig = {
                    path: './UserCase/laser/20w_laser_module/wooden_ruler.snaplzr',
                    name: 'wooden_ruler.snaplzr',
                };
                break;
            }
            case L40WLaserToolModule.identifier: {
                pathConfig = {
                    path: './UserCase/laser/40w_laser_module/wooden_ruler.snaplzr',
                    name: 'wooden_ruler.snaplzr',
                };
                break;
            }
            default: {
                switch (machineIdentifier) {
                    case SnapmakerOriginalMachine.identifier:
                    case SnapmakerOriginalExtendedMachine.identifier:
                        pathConfig = {
                            path: './UserCase/laser/original_200mw/laser_original_200mW.snaplzr',
                            name: 'laser_original_200mW.snaplzr'
                        };
                        break;
                    case SnapmakerA150Machine.identifier:
                        pathConfig = {
                            path: './UserCase/laser/a150_1600mw/laser_a150_1600mW.snaplzr',
                            name: 'laser_a150_1600mW.snaplzr'
                        };
                        break;
                    case SnapmakerA250Machine.identifier:
                        pathConfig = {
                            path: './UserCase/laser/a250_1600mw/laser_a250_1600mW.snaplzr',
                            name: 'laser_a250_1600mW.snaplzr'
                        };
                        break;
                    case SnapmakerA350Machine.identifier:
                        pathConfig = {
                            path: './UserCase/laser/a350_1600mw/laser_a350_1600mW.snaplzr',
                            name: 'laser_a350_1600mW.snaplzr'
                        };
                        break;
                    case SnapmakerArtisanMachine.identifier:
                        pathConfig = {
                            path: './UserCase/laser/a350_10w/wooden_ruler.snaplzr',
                            name: 'wooden_ruler.snaplzr',
                        };
                        break;
                    default:
                        pathConfig = {
                            path: './UserCase/laser/original_200mw/laser_original_200mW.snaplzr',
                            name: 'laser_original_200mW.snaplzr'
                        };
                        break;
                }

                break;
            }
        }
    }

    return pathConfig;
};

interface StarterGuideProps {
    machineIdentifer: string;
    toolHeadIdentifier: string;
    isRotate: boolean;
    toolPaths: Array<{ id: string }>;
    onClose?: () => void;
}

const StarterGuide: React.FC<StarterGuideProps> = (props) => {
    const { machineIdentifer, toolHeadIdentifier, isRotate, toolPaths, onClose } = props;

    const steps = useMemo(() => {
        return getSteps(machineIdentifer, isRotate);
    }, [machineIdentifer, isRotate]);

    const dispatch = useDispatch();
    const onBeforeChange = useCallback(async (nextIndex: number) => {
        if (nextIndex === 4) {
            dispatch(editorActions.switchToPage(HEAD_LASER, PAGE_PROCESS));
            dispatch(editorActions.selectToolPathId(HEAD_LASER, toolPaths[0].id));
        } else if (nextIndex === 6) {
            await dispatch(editorActions.preview(HEAD_LASER));
            await dispatch(editorActions.commitGenerateGcode(HEAD_LASER));
        }
    }, [dispatch, toolPaths]);

    const history = useHistory();
    const onChange = useCallback((nextIndex: number) => {
        if (nextIndex === 1) {
            const pathConfig = getShowCaseProject(machineIdentifer, toolHeadIdentifier, isRotate);
            dispatch(projectActions.openProject(pathConfig, history, true, true));
        }
    }, [
        dispatch, history,
        machineIdentifer, isRotate,
    ]);

    const onExit = useCallback(() => {
        onClose && onClose();
    }, [onClose]);

    return (
        <Steps
            enabled
            initialStep={0}
            onBeforeChange={onBeforeChange}
            onChange={onChange}
            options={{
                showBullets: false,
                hidePrev: false,
                exitOnEsc: false,
                exitOnOverlayClick: false
            }}
            steps={steps}
            onExit={onExit}
        />
    );
};

export default StarterGuide;
