import {
    HEAD_PRINTING
} from '../../constants';

class PresetDefinitionModel {
    headType = HEAD_PRINTING;
    definitionId = '';
    params = {
        // "speed": {
        //     "options": [
        //         {
        //             "low": {
        //                 "layer_height":1,
        //                 "b":2,
        //             },
        //             "relatedDefault": {
        //                 "layer_height":1,
        //                 "b":2,
        //             },
        //             "label": "ddd"
        //         },
        //         {
        //             "high": {
        //                 "a":1,
        //                 "b":2,
        //             },
        //         },
        //     ],
        //     "default_value": 'high'
        // },
    };

    definition = {};

    // init definitionId and definition
    // constructor() {
    //
    // }

    onChange() {

    }

    onChangeProfile() {

    }

    reset() {

    }

    duplicated() {

    }
}

const presetDefinitionModel = new PresetDefinitionModel();

export default presetDefinitionModel;
