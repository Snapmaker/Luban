import type { Machine } from '@snapmaker/luban-platform';
import { includes } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';

import i18n from '../../../lib/i18n';
import '../../../styles/introCustom.styl';
import Steps from '../../components/Steps';
import {
    getStepIntroFromText, printIntroStepEight,
    printIntroStepFive,
    printIntroStepFour,
    printIntroStepNine,
    printIntroStepOne,
    printIntroStepSeven,
    printIntroStepThree
} from '../introContent';

import { MACHINE_SERIES } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import PrintingObjectListStyles from '../../views/PrintingObjectList/styles.styl';

declare interface StarterGuideProps {
    enabled: boolean;
    initialStep: number;
    onChange: () => {};
    onExit: () => {};
}

const StarterGuide: React.FC<StarterGuideProps> = (props) => {
    const { enabled, initialStep = 0, onChange, onExit } = props;

    const activeMachine: Machine | null = useSelector((state: RootState) => state.machine.activeMachine);

    const isOriginal = includes(
        [
            MACHINE_SERIES.ORIGINAL.identifier,
            MACHINE_SERIES.ORIGINAL_LZ.identifier,
        ],
        activeMachine?.identifier
    );

    if (!enabled) {
        return null;
    }

    return (
        <Steps
            enabled
            initialStep={initialStep}
            onChange={onChange}
            options={{
                showBullets: false,
                keyboardNavigation: false,
                exitOnOverlayClick: false
            }}
            steps={[
                {
                    element: '.print-tool-bar-open',
                    intro: printIntroStepOne(i18n._('key-Printing/Page-Import an object, or drag an object to Luban.')),
                    position: 'right',
                    title: `${i18n._('key-Printing/Page-Import Object')} (1/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-import-intro'
                },
                {
                    element: `.${PrintingObjectListStyles['object-list-view']}`,
                    intro: getStepIntroFromText(i18n._('key-Printing/Beginner Guide-Object List Introduction')),
                    position: 'right',
                    title: `${i18n._('key-Printing/ObjectList-Object List')} (2/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-placement-intro'
                },
                {
                    element: '.print-intro-three',
                    intro: getStepIntroFromText(i18n._('key-Printing/Page-Place or transform the object using icons, including Move, Scale, Rotate, Mirror, and Manual Support.')),
                    position: 'right',
                    title: `${i18n._('key-Printing/Page-Placement')} (3/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-placement-intro'
                }, {
                    element: '.print-edit-model-intro',
                    intro: printIntroStepThree(
                        i18n._('key-Printing/Page-Arrange and edit objects to achieve the intended 3D printing effect.')
                    ),
                    position: 'bottom',
                    title: `${i18n._('key-Printing/Page-Edit Objects')} (4/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-edit-model-intro'
                }, {
                    element: '.print-machine-material-intro',
                    intro: printIntroStepFour(
                        i18n._('key-Printing/Page-Select the machine model and the materials you use.')
                    ),
                    position: 'left',
                    title: `${i18n._('key-Printing/Page-Select Machine and Materials')} (5/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-machine-material-intro'
                }, {
                    element: '.configuration-view',
                    intro: printIntroStepFive(
                        i18n._('key-Printing/Page-Select a printing mode.'),
                        i18n._('key-Printing/Page-Unfold Printing Settings to adjust printing parameters.')
                    ),
                    position: 'left',
                    title: `${i18n._('key-Printing/Page-Configure Parameters')} (6/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-configure-parameters-intro'
                }, {
                    element: '.print-output-intro',
                    intro: printIntroStepSeven(
                        i18n._('key-Printing/Page-Slice and preview the object.'),
                        i18n._('key-Printing/Page-In Preview, you can see printing paths using features, including Line Type and Layer View.'),
                        isOriginal
                    ),
                    position: 'top',
                    title: `${i18n._('key-Printing/Page-Generate G-code and Preview')} (7/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-preview-intro'
                }, {
                    element: '.print-output-intro',
                    intro: printIntroStepEight(i18n._('key-Printing/Page-Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start printing.')),
                    position: 'top',
                    title: `${i18n._('key-Printing/Page-Export and Print')} (8/9)`,
                    disableInteraction: true,
                    highlightClass: 'printing-export-highlight-part',
                    tooltipClass: 'printing-export-intro'
                }, {
                    element: '.printing-save-icon',
                    intro: printIntroStepNine(i18n._('key-Printing/Page-Save the project to a local device for reuse.')),
                    position: 'bottom',
                    title: `${i18n._('key-Printing/Page-Save Project')} (9/9)`,
                    disableInteraction: true,
                    tooltipClass: 'printing-save-intro'
                }
            ]}
            onExit={onExit}
        />
    );
};

export default StarterGuide;
