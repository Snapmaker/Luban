import { Alert, Button, Radio, RadioChangeEvent, Space } from 'antd';
import React, { useCallback, useState } from 'react';

import i18n from '../../../lib/i18n';


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
    const [setupCoordinateMethod, setSetupCoordinateMethod] = useState(SetupCoordinateMethod.Manual);

    const onChangeCoordinateMode = useCallback((e: RadioChangeEvent) => {
        setSetupCoordinateMethod(e.target.value);
    }, []);


    const onClickRunBoundary = useCallback(() => {
        console.log('Run Boundary');
    }, []);

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
                            <Alert type="info" showIcon message="Please go the machine, click button to run boundary." />
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
