import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { MACHINE_SERIES } from '../../constants';
// import api from '../../api';
import modal from '../../lib/modal';
import { timestamp } from '../../../shared/lib/random-utils';
import { CaseConfigOriginal, CaseConfig150, CaseConfig250, CaseConfig350, CaseConfigA350FourAxis, CaseConfigA250FourAxis } from './CaseConfig';
import { actions as projectActions } from '../../flux/project';
import i18n from '../../lib/i18n';
import styles from './index.styl';

// const tmpFile = `/Tmp/${targetFile}`;
class CaseLibrary extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        series: PropTypes.string.isRequired,
        headType: PropTypes.string,
        isConnected: PropTypes.bool,
        openProject: PropTypes.func.isRequired,
        // laser: PropTypes.object.isRequired,
        use4Axis: PropTypes.bool.isRequired
    };


    state = {
    };

    actions = {
        load3dpCaseSettings: async (config) => {
            const materialDefinitionId = config.material.definitionId;
            const materialDefinitionName = config.material.definitionName;
            const materialDefinition = this.props.materialDefinitions.find(d => d.definitionId === materialDefinitionId);
            if (materialDefinition) {
                this.props.updateDefaultMaterialId(materialDefinitionId);
                this.props.updateActiveDefinition(materialDefinition);
            } else {
                const defaultDefinition = this.props.materialDefinitions.find(d => d.definitionId === 'material.pla');
                const addDefinition = config.material;
                const newDefinition = await this.props.duplicateMaterialDefinition(defaultDefinition, materialDefinitionId, materialDefinitionName);
                const newDefinitionSettings = {};
                for (const [key] of Object.entries(newDefinition.settings)) {
                    if (!isUndefined(addDefinition[key])) {
                        newDefinitionSettings[key] = { 'default_value': addDefinition[key] };
                        newDefinition.settings[key].default_value = addDefinition[key];
                    }
                }
                await this.props.updateDefinitionSettings(newDefinition, newDefinitionSettings);

                // Select new definition after creation
                this.props.updateDefaultMaterialId(newDefinition.definitionId);
                this.props.updateActiveDefinition(newDefinition);
            }

            const qualityDefinitionId = config.quality.definitionId;
            const qualityDefinitionName = config.quality.definitionName;
            const qualityDefinition = await this.props.qualityDefinitions.find(d => d.definitionId === qualityDefinitionId);
            if (qualityDefinition) {
                if (['quality.fast_print', 'quality.normal_quality', 'quality.high_quality'].indexOf(qualityDefinitionId) === -1) {
                    this.props.updateIsRecommended(false);
                } else {
                    this.props.updateIsRecommended(true);
                }

                this.props.updateDefaultQualityId(qualityDefinitionId);
                this.props.updateActiveDefinition(qualityDefinition);
            } else {
                const defaultDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'quality.normal_quality');
                const addDefinition = config.quality;
                const newDefinition = await this.props.duplicateQualityDefinition(defaultDefinition, qualityDefinitionId, qualityDefinitionName);

                const newDefinitionSettings = {};
                for (const [key] of Object.entries(newDefinition.settings)) {
                    if (!isUndefined(addDefinition[key])) {
                        newDefinitionSettings[key] = { 'default_value': addDefinition[key] };
                        newDefinition.settings[key].default_value = addDefinition[key];
                    }
                }

                await this.props.updateDefinitionSettings(newDefinition, newDefinitionSettings);
                this.props.updateIsRecommended(false);
                this.props.updateDefaultQualityId(newDefinition.definitionId);
                this.props.updateActiveDefinition(newDefinition);
            }
        },
        loadLaserCncCaseSettings: async (config) => {
            if (config.mode === 'text') {
                if (config.tag === 'laser') {
                    await this.props.insertDefaultLaserTextVector(config.caseConfigs, config.caseTransformation);
                } else {
                    await this.props.insertDefaultCncTextVector(config.caseConfigs, config.caseTransformation);
                }
            } else {
                if (config.materials) {
                    this.props.updateMaterials(config.tag, config.materials);
                }
                if (config.tag === 'laser') {
                    await this.props.uploadLaserCaseImage(config.pathConfig, config.mode, config.caseConfigs, config.caseTransformation, () => {
                        modal({
                            title: i18n._('Parse Error'),
                            body: i18n._('Failed to parse image file {{filename}}.', { filename: config.pathConfig.name })
                        });
                    });
                } else {
                    await this.props.uploadCncCaseImage(config.pathConfig, config.mode, config.caseConfigs, config.caseTransformation, () => {
                        modal({
                            title: i18n._('Parse Error'),
                            body: i18n._('Failed to parse image file {{filename}}.', { filename: config.pathConfig.name })
                        });
                    });
                }
            }
        }
    }

    loadCase = (config) => {
        this.props.openProject(config.pathConfig, this.props.history);
    };


    render() {
        let CaseConfig;
        if (this.props.series === MACHINE_SERIES.ORIGINAL.value) {
            CaseConfig = CaseConfigOriginal;
        } else if (this.props.series === MACHINE_SERIES.CUSTOM.value) {
            CaseConfig = CaseConfigOriginal;
        } else if (this.props.series === MACHINE_SERIES.A150.value) {
            CaseConfig = CaseConfig150;
        } else if (this.props.series === MACHINE_SERIES.A250.value) {
            CaseConfig = CaseConfig250;
        } else if (this.props.series === MACHINE_SERIES.A350.value) {
            CaseConfig = CaseConfig350;
        } else {
            CaseConfig = CaseConfig150;
        }
        let CaseConfigFourAxis;
        if (this.props.series === MACHINE_SERIES.A250.value) {
            CaseConfigFourAxis = CaseConfigA250FourAxis;
        } else if (this.props.series === MACHINE_SERIES.A350.value) {
            CaseConfigFourAxis = CaseConfigA350FourAxis;
        }

        return (
            <div className={styles.caselibrary}>

                <div className={classNames(styles.container, styles.usecase)}>
                    <h2 className={styles.mainTitle}>
                        {i18n._('Featured Projects')}
                    </h2>
                    <h2 className={styles.subTitle}>
                        {i18n._('3-axis')}
                    </h2>
                    <div className={styles.columns}>
                        { CaseConfig.map((config) => {
                            return (
                                <div
                                    className={styles.column}
                                    key={config.pathConfig.name + timestamp()}
                                >
                                    <div>
                                        <img className={styles.imgIcon} src={config.imgSrc} alt="" />
                                    </div>
                                    <div className={styles.cardtext}>
                                        <h4>{config.title}</h4>
                                        <p>{i18n._('by Snapmaker')}</p>
                                    </div>

                                    <button
                                        type="button"
                                        className={classNames(
                                            'sm-btn-large',
                                            'sm-btn-default',
                                            styles.load,
                                        )}
                                        disabled={this.props.isConnected && this.props.headType !== config.tag}
                                        onClick={() => this.loadCase(config)}
                                    >
                                        {i18n._('Load')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    {this.props.use4Axis && CaseConfigFourAxis && (
                        <div>
                            <h2 className={styles.subTitle}>
                                {i18n._('4-axis')}
                            </h2>
                            <div className={styles.columns}>
                                { CaseConfigFourAxis.map((config) => {
                                    return (
                                        <div
                                            className={styles.column}
                                            key={config.pathConfig.name + timestamp()}
                                        >
                                            <div>
                                                <img className={styles.imgIcon} src={config.imgSrc} alt={config.title} />
                                            </div>
                                            <div className={styles.cardtext}>
                                                <h4>{config.title}</h4>
                                                <p>{i18n._('by Snapmaker')}</p>
                                            </div>

                                            <button
                                                type="button"
                                                className={classNames(
                                                    'sm-btn-large',
                                                    'sm-btn-default',
                                                    styles.load,
                                                )}
                                                disabled={this.props.isConnected && ((this.props.series === MACHINE_SERIES.A150.value || this.props.series === MACHINE_SERIES.ORIGINAL.value) || this.props.headType !== config.tag)}
                                                onClick={() => this.loadCase(config)}
                                            >
                                                {i18n._('Load')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        series: machine.series,
        headType: machine.headType,
        isConnected: machine.isConnected,
        use4Axis: machine.use4Axis
    };
};


const mapDispatchToProps = (dispatch) => ({
    openProject: (headType, history) => dispatch(projectActions.open(headType, history))
});


export default connect(mapStateToProps, mapDispatchToProps)(withRouter(CaseLibrary));
