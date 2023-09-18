import { WorkflowStatus } from '@snapmaker/luban-platform';
import { Alert, Button, Radio, RadioChangeEvent, Space } from 'antd';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Box3 } from 'three';

import SocketEvent from '../../../communication/socket-events';
import { JobOffsetMode } from '../../../constants/coordinate';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import gcodeActions, { GCodeFileObject } from '../../../flux/workspace/actions-gcode';
import controller from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import ControlPanel from './ControlPanel';
import RunBoundaryModal from './modals/RunBoundaryModal';

export const getRunBoundayCode = (bbox: Box3, jobOffsetMode: JobOffsetMode) => {
    const gcodeList = [];

    if (jobOffsetMode === JobOffsetMode.Crosshair) {
        // Use crosshair to run boundary
        gcodeList.push('M2000 L13 P1'); // turn on crosshair
    } else if (jobOffsetMode === JobOffsetMode.LaserSpot) {
        // Use laser spot to run boundary
        gcodeList.push('M3 S0');
        gcodeList.push('G1 F6000 S10'); // turn on laser spot
    }

    gcodeList.push(
        'G90', // absolute position
    );

    gcodeList.push(
        'G92 X0 Y0', // set current position as origin
    );

    gcodeList.push(
        `G1 X${bbox.min.x} Y${bbox.min.y} F6000`, // run boundary
        `G1 X${bbox.min.x} Y${bbox.max.y}`,
        `G1 X${bbox.max.x} Y${bbox.max.y}`,
        `G1 X${bbox.max.x} Y${bbox.min.y}`,
        `G1 X${bbox.min.x} Y${bbox.min.y}`,
        'G1 X0 Y0 S0', // go back to origin
    );

    if (jobOffsetMode === JobOffsetMode.LaserSpot) {
        gcodeList.push('M5 S0'); // turn off laser spot
    }

    gcodeList.push(
        ';End', // empty line
    );

    const gcode = gcodeList.join('\n');

    return gcode;
};


enum SetupCoordinateMethod {
    // Move tool manually
    Manually = 'manually',

    // Move tool using control panel
    ByControlPanel = 'control-panel',
}

/**
 * Set Origin View for Ray.
 *
 * With this view, you can calibrate the coordinate system for the job to be done.
 *
 * 1) Set origin
 * 2) Run boundary of the job, to check if the target work area is wanted
 *
 * Note that the work process is designed for the Ray machine (GRBL), it's not a
 * general purpose work process.
 */
interface SetOriginViewProps {
    setDisplay: (display: boolean) => void;
}

const SetOriginView: React.FC<SetOriginViewProps> = (props) => {
    const { setDisplay } = props;

    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);

    // G-code
    const boundingBox = useSelector((state: RootState) => state.workspace.boundingBox);
    const workflowStatus = useSelector((state: RootState) => state.workspace.workflowStatus, shallowEqual);

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
    const [runBoundaryUploading, setRunBoundaryUploading] = useState(false);
    const [runBoundaryReady, setRunBoundaryReady] = useState(false);
    const jobOffsetMode: JobOffsetMode = useSelector((state: RootState) => state.laser.jobOffsetMode);

    const dispatch = useDispatch();

    /**
     * Run boundary
     *
     * - useCurrentPosition: Use current position as origin
     */
    const runBoundary = useCallback(async () => {
        setRunBoundaryReady(false);
        if (!boundingBox) {
            log.warn('No bounding box provided, please upload G-code first.');
            return;
        }

        log.info('Run Boundary... bbox =', boundingBox);

        const gcode = getRunBoundayCode(boundingBox, jobOffsetMode);

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], 'boundary.nc');

        const gcodeFileObject: GCodeFileObject = await dispatch(gcodeActions.uploadGcodeFile(file));

        setRunBoundaryUploading(true);
        controller
            .emitEvent(SocketEvent.CompressUploadFile, {
                filePath: gcodeFileObject.uploadName,
                targetFilename: 'boundary.nc',
            })
            .once(SocketEvent.CompressUploadFile, ({ err, text }) => {
                setRunBoundaryUploading(false);

                if (err) {
                    log.error('Unable to upload G-code to execute.');
                    log.error(err);
                    log.error(`Reason: ${text}`);
                    return;
                }

                log.info('Uploaded boundary G-code.');
                setRunBoundaryReady(true);
            });
    }, [dispatch, boundingBox, jobOffsetMode]);

    const executeGCode = useCallback(async (gcode: string) => {
        return dispatch(workspaceActions.executeGcode(gcode)) as unknown as Promise<void>;
    }, [dispatch]);

    return (
        <div>
            <div className="display-block margin-top-8">
                <Radio.Group onChange={onChangeCoordinateMode} value={setupCoordinateMethod}>
                    <Space direction="vertical">
                        <Radio value={SetupCoordinateMethod.Manually}>
                            <span className="display-block font-weight-bold">{i18n._('Manual Mode')}</span>
                            <span className="display-block color-black-3">{i18n._('You need to manually move the toolhead to the desired XY work origin.')}</span>
                        </Radio>
                        {/* Hide by control panel method */
                            false && (
                                <Radio value={SetupCoordinateMethod.ByControlPanel}>
                                    <span className="display-block font-weight-bold">{i18n._('Control Mode')}</span>
                                    <span className="display-block color-black-3">{i18n._('You need to use the Control panel to move the toolhead to the desired XY work origin.')}</span>
                                </Radio>
                            )
                        }
                    </Space>
                </Radio.Group>
            </div>
            {
                setupCoordinateMethod === SetupCoordinateMethod.Manually && (
                    <div className="margin-top-8">
                        <div className="width-percent-100">
                            <Button
                                type="default"
                                style={{ width: '100%', borderRadius: '4px' }}
                                disabled={!boundingBox}
                                loading={runBoundaryUploading}
                                onClick={async () => runBoundary()}
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
                    <div className="margin-top-16">
                        <ControlPanel
                            executeGCode={executeGCode}
                            runBoundary={async () => runBoundary()}
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

export default SetOriginView;
