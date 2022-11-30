import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ROTATE_MODE, SCALE_MODE, TRANSLATE_MODE } from '../../../constants';
import { NumberInput as Input } from '../Input';

const modeSuffix = {
    [ROTATE_MODE]: '°',
    [TRANSLATE_MODE]: 'mm',
    [SCALE_MODE]: '%'
};

const ControlsInput = (props) => {
    const [controlInputValue, setControlInputValue] = useState(null);
    const inputRef = useRef(controlInputValue);
    inputRef.current = controlInputValue;
    const [controlAxis, setControlAxis] = useState(['x']);
    const [controlMode, setControlMode] = useState(null);

    const updateControlInput = (event) => {
        const { detail } = event;
        setControlMode(detail.controlValue.mode);
        if (detail.controlValue.mode === ROTATE_MODE && detail.controlValue.axis === null) {
            setControlInputValue(null);
        } else {
            if (detail.controlValue.axis) {
                setControlAxis(detail.controlValue.axis.split(''));
            }
            setControlInputValue({ ...detail.controlValue.data });
        }
    };

    useEffect(() => {
        window.addEventListener('update-control-input', updateControlInput);
        return () => {
            window.removeEventListener('update-control-input', updateControlInput);
        };
    }, []);

    const controlInputTransform = (mode, axis, data) => {
        props.onControlInputTransform(mode, axis, data, inputRef.current);
    };
    return (
        <React.Fragment>
            {!(controlMode === TRANSLATE_MODE && controlAxis[0] === 'z') && (
                <div className={`canvas-input position-absolute border-${controlAxis[0]} translate-animation-3`} id="control-input" style={{ display: 'none' }}>
                    <Input
                        size="small"
                        placeholder="0"
                        value={controlInputValue ? controlInputValue[controlAxis[0]] : null}
                        suffix={modeSuffix[controlMode]}
                        allowUndefined
                        prefix={`${controlAxis[0].toUpperCase()}:`}
                        onPressEnter={(event) => {
                            let value = event.target.value;
                            if (controlMode === SCALE_MODE) {
                                value = (value <= 0 ? 1 : value);
                            }
                            controlInputTransform(controlMode, controlAxis[0], value);
                        }}
                    />
                </div>
            )}
            {controlAxis[1] && (
                <div className={`canvas-input position-absolute border-${controlAxis[1]} translate-animation-3`} id="control-input-2">
                    <Input
                        size="small"
                        placeholder="0"
                        value={controlInputValue ? controlInputValue[controlAxis[1]] : null}
                        suffix={modeSuffix[controlMode]}
                        prefix={`${controlAxis[1].toUpperCase()}:`}
                        allowUndefined
                        onPressEnter={(event) => {
                            controlInputTransform(controlMode, controlAxis[1], event.target.value);
                        }}
                    />
                </div>
            )}
        </React.Fragment>
    );
};
ControlsInput.propTypes = {
    onControlInputTransform: PropTypes.func
};

export default ControlsInput;
