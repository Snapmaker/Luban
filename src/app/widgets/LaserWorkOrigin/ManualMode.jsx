import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import MaterialThickness from './MaterialThickness';
import { NumberInput as Input } from '../../components/Input';
import Jog from './Jog';
import styles from './styles.styl';
import {
    LASER_HOOD_HEIGHT
} from '../../constants';


class ManualMode extends PureComponent {
    static propTypes = {
        isIdle: PropTypes.bool.isRequired,
        isConnected: PropTypes.bool.isRequired,
        workOriginDefined: PropTypes.bool.isRequired,
        previewPower: PropTypes.number.isRequired,
        workPower: PropTypes.number.isRequired,
        jogStep: PropTypes.number.isRequired,
        zOffset: PropTypes.number.isRequired,
        zOffsetSlider: PropTypes.number.isRequired,
        selectedThickness: PropTypes.number.isRequired,
        customThickness: PropTypes.number.isRequired,
        hoodTouchHeight: PropTypes.number.isRequired,
        hasHoodTouchHeight: PropTypes.bool.isRequired,
        hasFocusShift: PropTypes.bool.isRequired,
        focusShift: PropTypes.number.isRequired,
        focusShiftLoaded: PropTypes.bool.isRequired,
        coarseFocus: PropTypes.number.isRequired,
        modalStage: PropTypes.number.isRequired,
        actions: PropTypes.object.isRequired
    };

    sliderMarks = { 0: -2, 0.4: -1.6, 0.8: -1.2, 1.2: -0.8, 1.6: -0.4, 2: 0, 2.4: 0.4, 2.8: 0.8, 3.2: 1.2, 3.6: 1.6, 4: 2 };

    render() {
        const { isIdle, isConnected, workOriginDefined, previewPower, workPower, jogStep, zOffset, zOffsetSlider,
            selectedThickness, customThickness, hoodTouchHeight, hasFocusShift, focusShift, focusShiftLoaded,
            hasHoodTouchHeight, coarseFocus, modalStage, actions } = this.props;
        const finalHeight = focusShiftLoaded ? focusShift + selectedThickness : hoodTouchHeight + coarseFocus - LASER_HOOD_HEIGHT + zOffset;

        return (
            <div>
                {modalStage === 0 && (
                    <div>
                        <MaterialThickness
                            selectedThickness={selectedThickness}
                            customThickness={customThickness}
                            actions={actions}
                        />
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.applyMaterialThickness}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 1: Confirm the thickness of the material')}
                        >
                            {i18n._('Apply Material Thickness')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.nextModal}
                            disabled={!isIdle || !isConnected || workOriginDefined}
                            style={{ display: 'block', width: '100%', margin: '5px 0' }}
                            title={i18n._('Step 2: Start a new focus fine tune.')}
                        >
                            {i18n._('New Fine Tune')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.loadFocusShift}
                            disabled={!isIdle || !isConnected || !hasFocusShift}
                            style={{ display: 'block', width: '100%', margin: '5px 0' }}
                            title={i18n._('Alternative Step 2: Skip estimating the touch height and load the previous measured focus shift. Please confirm the current thickness of the material in Step 1')}
                        >
                            {i18n._('Load Focus Shift')}
                        </button>
                    </div>
                )}
                {modalStage === 1 && (
                    <div>
                        <img
                            src="images/laser/hood-touch-bed.jpg"
                            role="presentation"
                            style={{ display: 'block', width: '100%', marginTop: '10px' }}
                            alt="hood touch bed"
                        />
                        <Jog
                            jogStep={jogStep}
                            jog={actions.jog}
                            changeJogStep={actions.changeJogStep}
                        />
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.saveHoodTouchHeight}
                            disabled={!isIdle || !isConnected || workOriginDefined}
                            style={{ display: 'block', width: '100%', margin: '5px 0' }}
                            title={i18n._('Step 3: Touch the material surface with the laser hood. The current height will be saved to reduce errors. It will be disabled if work origin has been set. Home Z to reset')}
                        >
                            {i18n._('Save Touch Height')}
                        </button>
                    </div>
                )}
                {modalStage === 2 && !focusShiftLoaded && (
                    <div>
                        <Jog
                            jogStep={jogStep}
                            jog={actions.jog}
                            changeJogStep={actions.changeJogStep}
                        />
                        <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                        <span style={{ margin: '0 16px 0 0' }}>{i18n._('Preview Power')}(%)</span>
                        <Input
                            style={{ width: '50px' }}
                            min={1}
                            max={100}
                            value={previewPower}
                            onChange={actions.changePreviewPower}
                        />
                        <span style={{ margin: '0 16px 0 18px' }}>{i18n._('Work Power')}(%)</span>
                        <Input
                            style={{ width: '50px' }}
                            min={1}
                            max={100}
                            value={workPower}
                            onChange={actions.changeWorkPower}
                        />
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.saveCoarseFocus}
                            disabled={!isIdle || !isConnected}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 4: Move Z to get a small speckle and save the coarse focus height')}
                        >
                            {i18n._('Save Coarse Focus')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.setWorkOrigin}
                            disabled={!isIdle || !isConnected}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 5: Set the work origin for running the focal G-Code')}
                        >
                            {i18n._('Set Work Origin')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.runBoundary}
                            disabled={!isIdle || !isConnected || !workOriginDefined}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 5: Run the boundary of the G-Code in the workspace in preview power. Work origin required')}
                        >
                            {i18n._('Run Boundary')}
                        </button>
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.runFocalGcode}
                            disabled={!isIdle || !isConnected || !workOriginDefined}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 6: Run the focal G-Code. Work origin required')}
                        >
                            {i18n._('Run Focal G-Code')}
                        </button>
                    </div>
                )}
                {modalStage === 3 && (
                    <div>
                        <img
                            src="images/laser/lines-black.png"
                            role="presentation"
                            style={{ display: 'block', width: '100%', height: '40px', marginTop: '10px' }}
                            alt="ruler"
                        />
                        <Slider
                            className={styles['slider-manual']}
                            value={zOffsetSlider}
                            min={0}
                            max={4}
                            step={0.2}
                            marks={this.sliderMarks}
                            onChange={actions.onChangeZOffset}
                        />
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.applyZOffset}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 7: Match the height offset based on the thinnest line engraved by the focal G-Code')}
                        >
                            {i18n._('Apply height offset')}
                        </button>
                    </div>
                )}
                {modalStage === 4 && (
                    <div>
                        <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                        <p>
                            {i18n._('Touch Height')} :  {hoodTouchHeight} mm
                        </p>
                        <p>
                            {i18n._('Hood Length')} :  {LASER_HOOD_HEIGHT} mm
                        </p>
                        <p>
                            {i18n._('Coarse Focus')} :  {coarseFocus} mm
                        </p>
                        <p>
                            {i18n._('Ruler Offset')} :  {zOffset} mm
                        </p>
                        <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                        <p>
                            {i18n._('Material Thickness')} :  {selectedThickness} mm
                        </p>
                        <p>
                            {i18n._('Last Saved Focus Shift')} :  {focusShift} mm
                        </p>
                        <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                        <p>
                            {i18n._('Final Height')} :  {finalHeight} mm
                        </p>
                        <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={actions.confirmWorkOrigin}
                            disabled={!isIdle || !isConnected || (!focusShiftLoaded && !hasHoodTouchHeight)}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                            title={i18n._('Step 8: Confirm the work origin. Touch height or focus shift required')}
                        >
                            {i18n._('Confirm Work Origin')}
                        </button>
                    </div>
                )}
            </div>
        );
    }
}

export default ManualMode;
