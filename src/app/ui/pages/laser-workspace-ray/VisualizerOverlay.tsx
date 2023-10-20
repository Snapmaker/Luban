import classNames from 'classnames';
import React, { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';

import { actions as workspaceActions } from '../../../flux/workspace';
import gcodeActions from '../../../flux/workspace/actions-gcode';
import { GCodeFileObject } from '../../../flux/workspace/types';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';


const VisualizerOverlay: React.FC = () => {
    const dispatch = useDispatch();
    const fileInputRef = useRef<HTMLInputElement>();

    const onUploadGCode = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
            fileInputRef.current.click();
        }
    }, []);

    const onChangeFile = useCallback(async (event) => {
        const file = event.target.files[0];

        const gcodeFile: GCodeFileObject = await dispatch(gcodeActions.uploadGcodeFile(file));

        dispatch(workspaceActions.renderGcodeFile(gcodeFile, false, true));
    }, [dispatch]);

    return (
        <div
            className={classNames('position-absolute')}
            style={{
                top: '72px'
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".gcode,.nc"
                style={{ display: 'none' }}
                multiple={false}
                onChange={onChangeFile}
            />
            <div className="margin-top-16">
                <Button
                    type="primary"
                    onClick={onUploadGCode}
                >
                    {i18n._('Load New G-code')}
                </Button>
            </div>
        </div>
    );
};

export default VisualizerOverlay;
