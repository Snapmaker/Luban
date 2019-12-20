import classNames from 'classnames';
// import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import api from '../../api';
import modal from '../../lib/modal';
import { timestamp } from '../../../shared/lib/random-utils';
import { CaseConfig } from './CaseConfig';
import { actions as printingActions } from '../../flux/printing';
import { actions as sharedActions } from '../../flux/cncLaserShared';
// import { actions as laserActions } from '../../flux/laser';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class CaseLibrary extends PureComponent {
    static propTypes = {
        // laser: PropTypes.object.isRequired,
        insertDefaultCncTextVector: PropTypes.func.isRequired,
        insertDefaultLaserTextVector: PropTypes.func.isRequired,
        updateDefaultAdvised: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        materialDefinitions: PropTypes.array.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        duplicateMaterialDefinition: PropTypes.func.isRequired,
        duplicateQualityDefinition: PropTypes.func.isRequired,
        uploadCaseModel: PropTypes.func.isRequired,
        uploadCncCaseImage: PropTypes.func.isRequired,
        uploadLaserCaseImage: PropTypes.func.isRequired
    };


    state = {
    };

    actions = {
        load3dpCaseSettings: async (config) => {
            const materialDefinitionId = config.material.definitionId;
            const materialDefinition = this.props.materialDefinitions.find(d => d.definitionId === materialDefinitionId);
            if (materialDefinition) {
                this.props.updateDefaultMaterialId(materialDefinitionId);
                this.props.updateActiveDefinition(materialDefinition);
            } else {
                const defaultDefinition = this.props.materialDefinitions.find(d => d.definitionId === 'material.pla');
                const addDefinition = config.material;
                const newDefinition = await this.props.duplicateMaterialDefinition(defaultDefinition, materialDefinitionId);
                for (const key of defaultDefinition.ownKeys) {
                    if (newDefinition.settings[key] === undefined) {
                        continue;
                    }
                    newDefinition.settings[key].default_value = addDefinition[key];
                    newDefinition.settings[key].from = addDefinition.definitionId;
                }
                // Select new definition after creation
                this.props.updateDefaultMaterialId(newDefinition.definitionId);
            }

            const qualityDefinitionId = config.quality.definitionId;
            const qualityDefinition = await this.props.qualityDefinitions.find(d => d.definitionId === qualityDefinitionId);
            if (qualityDefinition) {
                if (['quality.fast_print', 'quality.normal_quality', 'quality.high_quality'].indexOf(qualityDefinitionId) === -1) {
                    this.props.updateDefaultAdvised(false);
                } else {
                    this.props.updateDefaultAdvised(true);
                }
                this.props.updateDefaultQualityId(qualityDefinitionId);
                this.props.updateActiveDefinition(qualityDefinition);
            } else {
                const defaultDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'quality.high_quality');
                const addDefinition = config.quality;
                const newDefinition = await this.props.duplicateQualityDefinition(defaultDefinition, qualityDefinitionId);
                for (const key of defaultDefinition.ownKeys) {
                    if (newDefinition.settings[key] === undefined) {
                        continue;
                    }
                    if (addDefinition[key] !== undefined) {
                        newDefinition.settings[key].default_value = addDefinition[key];
                        newDefinition.settings[key].from = addDefinition.definitionId;
                    }
                }
                this.props.updateDefaultAdvised(false);

                this.props.updateDefaultQualityId(newDefinition.definitionId);
            }
        },
        loadLaserCncCaseSettings: async (config) => {
            if (config.mode === 'trace') {
                const res = await api.uploadLaserCaseImage(config.pathConfig, config.mode, () => {
                    modal({
                        title: i18n._('Parse Image Error'),
                        body: i18n._('Failed to parse image file {{filename}}', { filename: config.pathConfig.name })
                    });
                });
                const result = await api.processTrace({
                    originalName: res.body.originalName,
                    uploadName: res.body.uploadName,
                    width: res.body.width,
                    height: res.body.height
                });
                console.log('trace', res, result);
            } else if (config.mode === 'text') {
                if (config.tag === 'laser') {
                    await this.props.insertDefaultLaserTextVector(config.caseConfigs, config.caseTransformation);
                } else {
                    await this.props.insertDefaultCncTextVector(config.caseConfigs, config.caseTransformation);
                }
            } else {
                if (config.tag === 'laser') {
                    await this.props.uploadLaserCaseImage(config.pathConfig, config.mode, config.caseConfigs, config.caseTransformation, () => {
                        modal({
                            title: i18n._('Parse Image Error'),
                            body: i18n._('Failed to parse image file {{filename}}', { filename: config.pathConfig.name })
                        });
                    });
                } else {
                    await this.props.uploadCncCaseImage(config.pathConfig, config.mode, config.caseConfigs, config.caseTransformation, () => {
                        modal({
                            title: i18n._('Parse Image Error'),
                            body: i18n._('Failed to parse image file {{filename}}', { filename: config.pathConfig.name })
                        });
                    });
                }
            }
        }

    }

    loadCase = (config) => {
        document.location.href = `/#/${config.tag}`;
        if (config.tag === '3dp') {
            this.actions.load3dpCaseSettings(config);
            this.props.uploadCaseModel(config.pathConfig);
        } else {
            this.actions.loadLaserCncCaseSettings(config);
        }
    }

    render() {
        return (
            <div className={styles.caselibrary}>

                <div className={classNames(styles.container, styles.usecase)}>
                    <h2 className={styles.mainTitle}>
                        {i18n._('Use Case')}
                    </h2>
                    <div className={styles.columns}>
                        { CaseConfig.map((config) => {
                            return (
                                <button
                                    type="button"
                                    className={styles.column}
                                    onClick={() => this.loadCase(config)}
                                    key={config.pathConfig.name + timestamp()}
                                >

                                    <img className={styles.imgIcon} src={config.imgSrc} alt="" />
                                    <div className={styles.cardtext}>
                                        <h4>Leopard</h4>
                                        <p>by Snapmaker</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className={classNames(styles.container, styles.videoTutorials)}>
                    <h2 className={styles.mainTitle}>
                        {i18n._('Video Tutorials')}
                    </h2>
                    <div className={styles.columns}>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/user-case/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/user-case/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/user-case/3d01.jpg" alt="" />
                            </div>
                        </div>
                        <div className={styles.column}>
                            <h4>Leopard</h4>
                            <div className={styles.cardtext}>
                                <img className={styles.imgIcon} src="../../images/user-case/3d01.jpg" alt="" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const printing = state.printing;
    const { qualityDefinitions, materialDefinitions, defaultMaterialId, activeDefinition } = printing;
    return {
        materialDefinitions,
        defaultMaterialId,
        qualityDefinitions,
        activeDefinition
    };
};


const mapDispatchToProps = (dispatch) => ({
    insertDefaultLaserTextVector: (caseConfigs, caseTransformation) => dispatch(sharedActions.insertDefaultTextVector('laser', caseConfigs, caseTransformation)),
    insertDefaultCncTextVector: (caseConfigs, caseTransformation) => dispatch(sharedActions.insertDefaultTextVector('cnc', caseConfigs, caseTransformation)),
    // uploadFont: (file) => dispatch(textActions.uploadFont(file)),
    updateLaserState: (params) => dispatch(sharedActions.updateState('laser', params)),
    uploadLaserCaseImage: (file, mode, caseConfigs, caseTransformation, onFailure) => dispatch(sharedActions.uploadCaseImage('laser', file, mode, caseConfigs, caseTransformation, onFailure)),
    uploadCncCaseImage: (file, mode, caseConfigs, caseTransformation, onFailure) => dispatch(sharedActions.uploadCaseImage('cnc', file, mode, caseConfigs, caseTransformation, onFailure)),


    updateDefaultAdvised: (isAdvised) => dispatch(printingActions.updateState({ 'isAdvised': isAdvised })),
    updateDefaultMaterialId: (defaultMaterialId) => dispatch(printingActions.updateState({ defaultMaterialId })),
    updateDefaultQualityId: (defaultQualityId) => dispatch(printingActions.updateState({ defaultQualityId })),
    updateActiveDefinition: (definition, shouldSave = false) => dispatch(printingActions.updateActiveDefinition(definition, shouldSave)),
    duplicateMaterialDefinition: (definition, newDefinitionId) => dispatch(printingActions.duplicateMaterialDefinition(definition, newDefinitionId)),
    duplicateQualityDefinition: (definition, newDefinitionId) => dispatch(printingActions.duplicateQualityDefinition(definition, newDefinitionId)),
    uploadCaseModel: (file) => dispatch(printingActions.uploadCaseModel(file))
});


export default connect(mapStateToProps, mapDispatchToProps)(CaseLibrary);
