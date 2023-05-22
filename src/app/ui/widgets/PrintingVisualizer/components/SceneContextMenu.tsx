import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { isDualExtruder } from '../../../../constants/machines';
import type { RootState } from '../../../../flux/index.def';
import { actions as printingActions } from '../../../../flux/printing';
import sceneActions from '../../../../flux/printing/actions-scene';
import i18n from '../../../../lib/i18n';
import ContextMenu from '../../../components/ContextMenu';


interface SceneContextMenuProps {
    id?: string;

    // TODO: Instead of passing canvas to context menu, refactor canvas actions
    //   as redux actions.
    canvas: React.RefObject<React.ReactNode>;
}

/**
 * Context Menu for the scene.
 */
const SceneContextMenu: React.FC<SceneContextMenuProps> = forwardRef((props, ref) => {
    const { id = 'scene-context-menu', canvas } = props;

    const contextMenuRef = useRef(null);

    const { toolHead } = useSelector((state: RootState) => state.machine);
    const isDual = isDualExtruder(toolHead.printingToolhead);

    const { modelGroup } = useSelector((state: RootState) => state.printing);
    const selectedModelArray = modelGroup.selectedModelArray;

    const isModelSelected = selectedModelArray.length > 0;
    const isMultipleModelSelected = selectedModelArray.length > 1;
    const isModelHidden = isModelSelected && !selectedModelArray[0].visible;

    const { inProgress, hasModel } = useSelector((state: RootState) => state.printing);
    const pasteDisabled = (modelGroup.clipboard.length === 0);

    const fitViewIn = useCallback(() => {
        if (selectedModelArray.length !== 0) {
            const { x, y, z } = modelGroup.getSelectedModelBBoxWHD();
            const selectedGroupBsphereRadius = Math.sqrt(x * x + y * y + z * z) / 2;
            canvas.current.fitViewIn(modelGroup.selectedGroup.position, selectedGroupBsphereRadius);
        } else {
            modelGroup.selectAllModels();
            const { x, y, z } = modelGroup.getSelectedModelBBoxWHD();
            const selectedGroupBsphereRadius = Math.sqrt(x * x + y * y + z * z) / 2;
            if (selectedGroupBsphereRadius > 0.000001) {
                canvas.current.fitViewIn(modelGroup.selectedGroup.position, selectedGroupBsphereRadius);
            }
            modelGroup.unselectAllModels();
        }
    }, [modelGroup, selectedModelArray, canvas]);

    const dispatch = useDispatch();

    const centerSelectedModel = useCallback(() => {
        dispatch(printingActions.updateSelectedModelTransformation({ positionX: 0, positionY: 0 }));

        canvas.current.updateBoundingBox();

        dispatch(printingActions.onModelAfterTransform());
    }, [dispatch, canvas]);

    /**
     * Set selected model(s) extruder to extruderId ('0' or '1').
     *
     * @param extruderId
     */
    const setSelectedModelsExtruder = useCallback((extruderId: string) => {
        dispatch(printingActions.updateSelectedModelsExtruder({
            shell: extruderId,
            infill: extruderId,
        }));
    }, [dispatch]);

    const menuItems = useMemo(() => {
        const items = [];

        items.push(
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Cut'),
                disabled: inProgress || !isModelSelected,
                onClick: () => dispatch(printingActions.cut()),
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Copy'),
                disabled: inProgress || !isModelSelected,
                onClick: () => dispatch(printingActions.copy()),
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Paste'),
                disabled: inProgress || pasteDisabled,
                onClick: () => dispatch(printingActions.paste()),
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Duplicate'),
                disabled: inProgress || !isModelSelected,
                onClick: () => dispatch(sceneActions.duplicateSelectedModel()),
            },
        );

        items.push(
            { type: 'separator' },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-FitViewIn'),
                disabled: inProgress || !hasModel,
                onClick: fitViewIn
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Hide'),
                disabled: inProgress || !isModelSelected,
                onClick: () => dispatch(sceneActions.hideModels()),
            },
        );

        if (isDual) {
            items.push(
                { type: 'separator' },
                {
                    type: 'item',
                    label: i18n._('key-Printing/ContextMenu-Assign model to left extruder'),
                    disabled: inProgress || !isModelSelected,
                    onClick: () => setSelectedModelsExtruder('0'),
                },
                {
                    type: 'item',
                    label: i18n._('key-Printing/ContextMenu-Assign model to right extruder'),
                    disabled: inProgress || !isModelSelected,
                    onClick: () => setSelectedModelsExtruder('1'),
                },
            );
        }

        items.push(
            { type: 'separator' },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Reset Model Transformation'),
                disabled: inProgress || !isModelSelected,
                onClick: () => dispatch(printingActions.resetSelectedModelTransformation()),
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Center Models'),
                disabled: inProgress || !isModelSelected,
                onClick: centerSelectedModel
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Auto Rotate'),
                disabled: inProgress || !isModelSelected || isModelHidden || isMultipleModelSelected,
                onClick: () => dispatch(printingActions.autoRotateSelectedModel()),
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Auto Arrange'),
                disabled: inProgress || !hasModel,
                onClick: () => {
                    const angle = 45, offset = 1, padding = 0;
                    dispatch(printingActions.arrangeAllModels(angle, offset, padding));
                },
            }
        );

        return items;
    }, [
        isDual,
        inProgress,
        hasModel, isModelSelected, isModelHidden, isMultipleModelSelected,
        pasteDisabled,

        // action functions
        dispatch,
        fitViewIn,
        centerSelectedModel,
        setSelectedModelsExtruder,
    ]);

    useImperativeHandle(ref, () => {
        return {
            show(event) {
                contextMenuRef.current.show(event);
            }
        };
    }, []);

    return (
        <ContextMenu
            ref={contextMenuRef}
            id={id}
            menuItems={menuItems}
        />
    );
});

export default SceneContextMenu;
