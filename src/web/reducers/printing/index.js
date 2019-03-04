import { ABSENT_OBJECT } from '../../constants';
import { timestamp } from '../../../shared/lib/random-utils';
import i18n from '../../lib/i18n';
import definitionManager from './DefinitionManager';


const INITIAL_STATE = {
    materialDefinitions: [],
    qualityDefinitions: [],

    // Active definition
    // fdm -> snapmaker -> active (machine, material, adhesion)
    activeDefinition: ABSENT_OBJECT
};


const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    init: () => async (dispatch) => {
        await definitionManager.init();

        dispatch(actions.updateState({
            materialDefinitions: definitionManager.materialDefinitions,
            qualityDefinitions: definitionManager.qualityDefinitions,
            activeDefinition: definitionManager.activeDefinition
        }));

        dispatch(actions.updateActiveDefinition(definitionManager.snapmakerDefinition));
    },

    // Update definition settings and save.
    updateDefinitionSettings: (definition, settings) => () => {
        settings = definitionManager.calculateDependencies(definition, settings);

        return definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            settings
        });
    },

    updateActiveDefinition: (definition, shouldSave = false) => (dispatch, getState) => {
        const state = getState().printing;

        const activeDefinition = {
            ...state.activeDefinition
        };

        // Note that activeDefinition can be updated by itself
        if (definition !== state.activeDefinition) {
            for (const key of definition.ownKeys) {
                if (activeDefinition.settings[key] === undefined) {
                    console.error('Unknown key ' + key);
                    continue;
                }
                activeDefinition.settings[key].default_value = definition.settings[key].default_value;
                activeDefinition.settings[key].from = definition.definitionId;
            }
        }

        if (shouldSave) {
            dispatch(actions.updateDefinitionSettings(activeDefinition, activeDefinition.settings));
        } else {
            // TODO: Optimize performance
            definitionManager.calculateDependencies(activeDefinition, activeDefinition.settings);
        }

        // Update activeDefinition to force component re-render
        dispatch(actions.updateState({ activeDefinition }));
    },

    duplicateQualityDefinition: (definition) => async (dispatch, getState) => {
        const state = getState().printing;

        const newDefinition = {
            definitionId: 'quality.' + timestamp(),
            name: '#' + definition.name,
            inherits: definition.inherits,
            ownKeys: definition.ownKeys,
            settings: {}
        };

        // Find a name not been used
        while (state.qualityDefinitions.find(d => d.name === newDefinition.name)) {
            newDefinition.name = '#' + newDefinition.name;
        }

        // Simplify settings
        for (const key of definition.ownKeys) {
            newDefinition.settings[key] = {
                default_value: definition.settings[key].default_value
            };
        }

        const createdDefinition = await definitionManager.createDefinition(newDefinition);

        dispatch(actions.updateState({
            qualityDefinitions: [...state.qualityDefinitions, createdDefinition]
        }));

        return createdDefinition;
    },

    removeQualityDefinition: (definition) => async (dispatch, getState) => {
        const state = getState().printing;

        await definitionManager.removeDefinition(definition);

        dispatch(actions.updateState({
            qualityDefinitions: state.qualityDefinitions.filter(d => d.definitionId !== definition.definitionId)
        }));
    },

    updateQualityDefinitionName: (definition, name) => async (dispatch, getState) => {
        if (!name || name.trim().length === 0) {
            return Promise.reject(i18n._('Rename failed: the new name can not be empty.'));
        }

        const { qualityDefinitions } = getState().printing;
        const duplicated = qualityDefinitions.find(d => d.name === name);

        if (duplicated && duplicated !== definition) {
            return Promise.reject(i18n._('Rename failed: profile with name "{{name}}" exists.', { name }));
        }

        await definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            name
        });

        definition.name = name;

        return null;
    }
};


export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default:
            return state;
    }
}
