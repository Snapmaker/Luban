import { Alert, Button, Radio, RadioChangeEvent, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// import { actions as workspaceActions } from '../../../flux/workspace';
import gcodeActions, { GCodeFileObject } from '../../../flux/workspace/action-gcode';
import log from '../../../lib/log';
import i18n from '../../../lib/i18n';
import { RootState } from '../../../flux/index.def';
import controller from '../../../lib/controller';
import { CONNECTION_UPLOAD_FILE } from '../../../constants';


enum SetupCoordinateMethod {
    // Move tool manually
    Manual = 'manual',

    // Move tool using control panel
    ControlPanel = 'control-panel',
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
const MachiningView: React.FC = () => {
    const boundingBox = useSelector((state: RootState) => state.workspace.boundingBox);

    // setup coordinate method
    const [setupCoordinateMethod, setSetupCoordinateMethod] = useState(SetupCoordinateMethod.Manual);

    const onChangeCoordinateMode = useCallback((e: RadioChangeEvent) => {
        setSetupCoordinateMethod(e.target.value);
    }, []);

    // run boundary state
    const [runBoundaryReady, setRunBoundaryReady] = useState(false);

    const dispatch = useDispatch();

    /**
     * On click run boundary (Manual)
     */
    const onClickRunBoundary = useCallback(async () => {
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
            'G92 X0 Y0', // set current position as origin
            `G0 X${bbox.min.x} Y${bbox.min.y} F1200`, // run boundary
            `G0 X${bbox.min.x} Y${bbox.max.y}`,
            `G0 X${bbox.max.x} Y${bbox.max.y}`,
            `G0 X${bbox.max.x} Y${bbox.min.y}`,
            `G0 X${bbox.min.x} Y${bbox.min.y}`,
            'G0 X0 Y0', // go back to origin
        );

        const gcode = gcodeList.join('\n');

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], 'boundary.nc');

        const gcodeFileObject: GCodeFileObject = await dispatch(gcodeActions.uploadGcodeFile(file));

        // dispatch(workspaceActions.executeGcode(gcode));
        controller
            .emitEvent(CONNECTION_UPLOAD_FILE, {
                gcodePath: `/${gcodeFileObject.uploadName}`,
                renderGcodeFileName: 'boundary.nc',
            })
            .once(CONNECTION_UPLOAD_FILE, ({ err, text }) => {
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

    return (
        <div>
            <div className="display-block margin-top-8">
                <Radio.Group onChange={onChangeCoordinateMode} value={setupCoordinateMethod}>
                    <Space direction="vertical">
                        <Radio value={SetupCoordinateMethod.Manual}>
                            <span className="display-block font-weight-bold">Use origin by move tool head manually</span>
                            <span className="display-block color-black-3">In this mode, steppers will be disabled. You will need to move the tool head to align light spot to desired origin.</span>
                        </Radio>
                        <Radio value={SetupCoordinateMethod.ControlPanel}>
                            <span className="display-block font-weight-bold">Use origin set by control panel</span>
                            <span className="display-block color-black-3">In this mode, you will need to set origin using the control pad. Use the control panel to move the tool head to align light spot to desired origin. Then set it as origin of your job.</span>
                        </Radio>
                    </Space>
                </Radio.Group>
            </div>
            {
                setupCoordinateMethod === SetupCoordinateMethod.Manual && (
                    <div className="margin-top-8">
                        <div className="width-percent-100">
                            <Button
                                type="default"
                                style={{ width: '100%' }}
                                onClick={onClickRunBoundary}
                            >
                                {i18n._('key-Workspace/Control/MotionButton-Run Boundary')}
                            </Button>
                        </div>
                        <Space direction="vertical" className="margin-top-8">
                            <Alert type="info" showIcon message="Steppers are disabled. You can push XY axes to move the tool head." />
                            {
                                runBoundaryReady && (
                                    <Alert type="info" showIcon message="Please go the machine, click button to run boundary." />
                                )
                            }
                        </Space>
                    </div>
                )
            }

            {
                setupCoordinateMethod === SetupCoordinateMethod.ControlPanel && (
                    <div className="margin-top-8">
                        TODO: Control Panel for XY axes only
                    </div>
                )
            }
        </div>
    );
};

export default MachiningView;
