import { WorkflowStatus } from '@snapmaker/luban-platform';
import { Alert, Button, Radio, RadioChangeEvent, Space } from 'antd';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import ControllerEvent from '../../../connection/controller-events';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import gcodeActions, { GCodeFileObject } from '../../../flux/workspace/actions-gcode';
import controller from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import ControlPanel from './ControlPanel';
import RunBoundaryModal from './modals/RunBoundaryModal';


enum SetupCoordinateMethod {
    // Move tool manually
    Manually = 'manually',

    // Move tool using control panel
    ByControlPanel = 'control-panel',
}

/**
 * Machining View for Ray.
 *
 * With this view, you can calibrate the coordinate system for the job to be done.
 *
 * 1) Set origin
 * 2) Run boundary of the job, to check if the target work area is wanted
 *
 * Note that the work process is designed for the Ray machine (GRBL), it's not a
 * general purpose work process.
 */
interface MachiningViewProps {
    setDisplay: (display: boolean) => void;
}

const MachiningView: React.FC<MachiningViewProps> = (props) => {
    const { setDisplay } = props;

    // G-code
    const boundingBox = useSelector((state: RootState) => state.workspace.boundingBox);

    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);
    const workflowStatus = useSelector((state: RootState) => state.workspace.workflowStatus);

    // display of widget
    // Only when machine is IDLE
    useEffect(() => {
        if (isConnected && includes([WorkflowStatus.Unknown, WorkflowStatus.Idle], workflowStatus)) {
            setDisplay(true);
        } else {
            // TODO: job is done, but workflow is IDLE => not display
            setDisplay(false);
        }
    }, [setDisplay, isConnected, workflowStatus]);

    // setup coordinate method
    const [setupCoordinateMethod, setSetupCoordinateMethod] = useState(SetupCoordinateMethod.Manually);

    const onChangeCoordinateMode = useCallback((e: RadioChangeEvent) => {
        setSetupCoordinateMethod(e.target.value);
    }, []);

    // run boundary state
    const [runBoundaryReady, setRunBoundaryReady] = useState(false);

    const dispatch = useDispatch();

    /**
     * Run boundary
     *
     * - useCurrentPosition(Manual)
     */
    const runBoundary = useCallback(async ({ useCurrentPosition = false }) => {
        setRunBoundaryReady(false);
        if (!boundingBox) {
            log.warn('No bounding box provided, please upload G-code first.');
            return;
        }

        log.info('Run Boundary... bbox =', boundingBox);
        const bbox = boundingBox;

        const gcodeList = [];
        gcodeList.push(
            'G90', // absolute position
        );

        if (useCurrentPosition) {
            gcodeList.push(
                'G92 X0 Y0', // set current position as origin
            );
        }

        gcodeList.push(
            `G1 X${bbox.min.x} Y${bbox.min.y} F1800 S0`, // run boundary
            `G1 X${bbox.min.x} Y${bbox.max.y}`,
            `G1 X${bbox.max.x} Y${bbox.max.y}`,
            `G1 X${bbox.max.x} Y${bbox.min.y}`,
            `G1 X${bbox.min.x} Y${bbox.min.y}`,
            'G1 X0 Y0', // go back to origin
            ';End', // empty line
        );

        const gcode = gcodeList.join('\n');

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], 'boundary.nc');

        const gcodeFileObject: GCodeFileObject = await dispatch(gcodeActions.uploadGcodeFile(file));

        controller
            .emitEvent(ControllerEvent.CompressUploadFile, {
                filePath: gcodeFileObject.uploadName,
                targetFilename: 'boundary.nc',
            })
            .once(ControllerEvent.CompressUploadFile, ({ err, text }) => {
                if (err) {
                    log.error('Unable to upload G-code to execute.');
                    log.error(err);
                    log.error(`Reason: ${text}`);
                } else {
                    log.info('Uploaded boundary G-code.');
                    setRunBoundaryReady(true);
                }
            });
    }, [dispatch, boundingBox]);

    const executeGCode = useCallback(async (gcode: string) => {
        return dispatch(workspaceActions.executeGcode(gcode)) as unknown as Promise<void>;
    }, [dispatch]);

    return (
        <div>
            <div className="display-block margin-top-8">
                <Radio.Group onChange={onChangeCoordinateMode} value={setupCoordinateMethod}>
                    <Space direction="vertical">
                        <Radio value={SetupCoordinateMethod.Manually}>
                            <span className="display-block font-weight-bold">{i18n._('Use origin by move tool head manually')}</span>
                            <span className="display-block color-black-3">{i18n._('In this mode, steppers will be disabled. You will need to move the tool head to align light spot to desired origin.')}</span>
                        </Radio>
                        <Radio value={SetupCoordinateMethod.ByControlPanel}>
                            <span className="display-block font-weight-bold">{i18n._('Use origin set by control panel')}</span>
                            <span className="display-block color-black-3">{i18n._('In this mode, you will need to set origin using the control pad. Use the control panel to move the tool head to align light spot to desired origin. Then set it as origin of your job.')}</span>
                        </Radio>
                    </Space>
                </Radio.Group>
            </div>
            {
                setupCoordinateMethod === SetupCoordinateMethod.Manually && (
                    <div className="margin-top-8">
                        <div className="width-percent-100">
                            <Button
                                type="default"
                                style={{ width: '100%' }}
                                onClick={async () => runBoundary({
                                    useCurrentPosition: true,
                                })}
                            >
                                {i18n._('Run Boundary')}
                            </Button>
                        </div>
                        <Space direction="vertical" className="margin-top-8">
                            <Alert type="info" showIcon message={i18n._('Steppers are disabled. You can push XY axes to move the tool head.')} />
                        </Space>
                    </div>
                )
            }

            {
                setupCoordinateMethod === SetupCoordinateMethod.ByControlPanel && (
                    <div className="margin-top-8">
                        <ControlPanel
                            executeGCode={executeGCode}
                            runBoundary={async () => runBoundary({
                                useCurrentPosition: false,
                            })}
                        />
                    </div>
                )
            }

            {/* Run Boundary modal */
                runBoundaryReady && (
                    <RunBoundaryModal onClose={() => setRunBoundaryReady(false)} />
                )
            }
        </div>
    );
};

export default MachiningView;
