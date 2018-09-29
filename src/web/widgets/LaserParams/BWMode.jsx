import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import { BOUND_SIZE } from '../../constants';
import i18n from '../../lib/i18n';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import UploadControl from './UploadControl';
import { actions } from '../../reducers/modules/laser';
import styles from './styles.styl';


class BWMode extends PureComponent {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired,
        params: PropTypes.object.isRequired,
        anchorOptions: PropTypes.array.isRequired,

        // actions from parent
        onChangeFile: PropTypes.func.isRequired,
        onChangeWidth: PropTypes.func.isRequired,
        onChangeHeight: PropTypes.func.isRequired,

        // redux actions
        setTarget: PropTypes.func.isRequired,
        setParams: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    actions = {
        onChangeBWThreshold: (bwThreshold) => {
            this.props.setParams({ bwThreshold });
        },
        onChangeDirection: (option) => {
            this.props.setParams({ direction: option.value });
        },
        onChangeDensity: (density) => {
            this.props.setParams({ density });
        },
        onChangeAnchor: (option) => {
            this.props.setTarget({ anchor: option.value });
        }
    };

    render() {
        const {
            source, target, params, anchorOptions,
            onChangeFile, onChangeWidth, onChangeHeight, preview
        } = this.props;
        const actions = this.actions;

        return (
            <React.Fragment>
                <UploadControl
                    accept={source.accept}
                    onChangeFile={onChangeFile}
                    filename={source.filename}
                    width={source.width}
                    height={source.height}
                />
                <table className={styles['parameter-table']} style={{ marginTop: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('B&W')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('B&W')}
                                    content={i18n._('Set the proportion of the black color based on the original color of the image.')}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'inline-block', width: '80%', marginTop: '10px' }}>
                                            <Slider
                                                value={params.bwThreshold}
                                                min={0}
                                                max={255}
                                                onChange={actions.onChangeBWThreshold}
                                            />
                                        </div>
                                        <Input
                                            style={{ float: 'right', width: '35px' }}
                                            className={classNames(styles.input, styles['input-narrow'])}
                                            value={params.bwThreshold}
                                            min={0}
                                            max={255}
                                            onChange={actions.onChangeBWThreshold}
                                        />
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Size (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={target.width}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={onChangeWidth}
                                    />
                                    <span className={styles['description-text']} style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={target.height}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={onChangeHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Line Direction')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Line Direction')}
                                    content={i18n._('Select the direction of the engraving path.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="line_direction"
                                        options={[{
                                            value: 'Horizontal',
                                            label: i18n._('Horizontal')
                                        }, {
                                            value: 'Vertical',
                                            label: i18n._('Vertical')
                                        }, {
                                            value: 'Diagonal',
                                            label: i18n._('Diagonal')
                                        }, {
                                            value: 'Diagonal2',
                                            label: i18n._('Diagonal2')
                                        }]}
                                        placeholder={i18n._('Choose an algorithm')}
                                        searchable={false}
                                        value={params.direction}
                                        onChange={actions.onChangeDirection}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Density')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Density')}
                                    content={i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={params.density}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onChange={actions.onChangeDensity}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>dot/mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Anchor')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Anchor')}
                                    content={i18n._('Find the anchor of the image to correspond to the (0, 0) coordinate.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={anchorOptions}
                                        placeholder={i18n._('Anchor')}
                                        value={target.anchor}
                                        onChange={actions.onChangeAnchor}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={preview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Preview')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    // anchor options is based on language selected
    const anchorOptions = [
        { label: i18n._('Center'), value: 'Center' },
        { label: i18n._('Center Left'), value: 'Center Left' },
        { label: i18n._('Center Right'), value: 'Center Right' },
        { label: i18n._('Bottom Left'), value: 'Bottom Left' },
        { label: i18n._('Bottom Middle'), value: 'Bottom Middle' },
        { label: i18n._('Bottom Right'), value: 'Bottom Right' },
        { label: i18n._('Top Left'), value: 'Top Left' },
        { label: i18n._('Top Middle'), value: 'Top Middle' },
        { label: i18n._('Top Right'), value: 'Top Right' }
    ];
    return {
        stage: state.laser.stage,
        source: state.laser.source,
        target: state.laser.target,
        params: state.laser.bwMode,
        anchorOptions: anchorOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        setParams: (state) => dispatch(actions.bwSetState(state)),
        preview: () => dispatch(actions.bwModePreview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(BWMode);
