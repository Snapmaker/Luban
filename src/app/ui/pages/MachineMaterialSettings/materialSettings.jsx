import { find } from 'lodash';
import { CaretRightOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { LEFT, RIGHT } from '../../../../server/constants';
import { Button } from '../../components/Buttons';
import AddMaterialModel from './addMaterialModel';
import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';

const MaterialSettings = () => {
    const { defaultMaterialId, defaultMaterialIdRight, materialDefinitions } = useSelector(state => state.printing);
    const [leftMaterialDefinitionId, setLeftMaterialDefinitionId] = useState(defaultMaterialId);
    const [leftMaterialDefinition, setLeftMaterialDefinition] = useState(find(materialDefinitions, { definitionId: leftMaterialDefinitionId }));
    const [rightMaterialDefinitionId, setRightMaterialDefinitionId] = useState(defaultMaterialIdRight);
    const [rightMaterialDefinition, setRightMaterialDefinition] = useState(find(materialDefinitions, { definitionId: rightMaterialDefinitionId }));
    const [definitionByCategory, setDefinitionByCategory] = useState({});
    const [activeCategory, setActiveCategory] = useState('PLA');
    const [activeNozzle, setActiveNozzle] = useState(LEFT);
    const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false);
    const dispatch = useDispatch();
    useEffect(() => {
        setLeftMaterialDefinition(find(materialDefinitions, { definitionId: leftMaterialDefinitionId }));
        setRightMaterialDefinition(find(materialDefinitions, { definitionId: rightMaterialDefinitionId }));
    }, [materialDefinitions, leftMaterialDefinitionId, rightMaterialDefinitionId]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === leftMaterialDefinitionId
        );
        dispatch(
            printingActions.updateDefaultMaterialId(
                definition.definitionId,
                LEFT_EXTRUDER
            )
        );
    }, [leftMaterialDefinitionId]);
    useEffect(() => {
        const definition = materialDefinitions.find(
            (d) => d.definitionId === rightMaterialDefinitionId
        );
        dispatch(
            printingActions.updateDefaultMaterialId(
                definition.definitionId,
                RIGHT_EXTRUDER
            )
        );
    }, [rightMaterialDefinitionId]);
    useEffect(() => {
        const definitionByCategoryTemp = {};
        materialDefinitions.forEach((definition) => {
            if (definitionByCategoryTemp[definition.category]) {
                definitionByCategoryTemp[definition.category].push(definition);
            } else {
                definitionByCategoryTemp[definition.category] = [definition];
            }
        });
        setDefinitionByCategory(definitionByCategoryTemp);
    }, [materialDefinitions]);

    const handleUpdateDefinition = (id) => {
        if (activeNozzle === LEFT) {
            setLeftMaterialDefinitionId(id);
        } else {
            setRightMaterialDefinitionId(id);
        }
    };
    return (
        <div className="padding-vertical-40 padding-horizontal-40 height-all-minus-60 overflow-y-auto">
            <div className="sm-flex justify-space-between">
                <div className="padding-horizontal-4 padding-vertical-4 border-radius-16 sm-flex background-grey-2 width-532">
                    <Anchor onClick={() => setActiveNozzle(LEFT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-16 width-264 height-68 ${activeNozzle === LEFT ? 'background-color-white' : ''}`}>
                        <div className="heading-3">{i18n._('key-setting/Left-Nozzle')}</div>
                        <div className="sm-flex align-center margin-top-8">
                            <div className="height-16 width-16 border-default-grey-1 " style={{ background: `${leftMaterialDefinition?.settings?.color?.default_value}` }} />
                            <span className="margin-left-8">{i18n._(leftMaterialDefinition.i18nName)}</span>
                        </div>
                    </Anchor>
                    <Anchor onClick={() => setActiveNozzle(RIGHT)} className={`padding-horizontal-16 padding-vertical-8 border-radius-16 width-264 height-68 ${activeNozzle === RIGHT ? 'background-color-white' : ''}`}>
                        <div className="heading-3">{i18n._('key-setting/Right-Nozzle')}</div>
                        <div className="sm-flex align-center margin-top-8">
                            <div className="height-16 width-16 border-default-grey-1" style={{ background: `${rightMaterialDefinition?.settings?.color?.default_value}` }} />
                            <span className="margin-left-8">{i18n._(rightMaterialDefinition.name)}</span>
                        </div>
                    </Anchor>
                </div>
                <div className="sm-flex">
                    <Button
                        priority="level-two"
                        width="160px"
                        type="default"
                    >
                        <span className="display-inline width-142 text-overflow-ellipsis">{i18n._('key-settings/Profile Manager')}</span>
                    </Button>
                    <Button
                        priority="level-two"
                        width="160px"
                        className="margin-left-16"
                        onClick={() => setShowCreateMaterialModal(true)}
                    >
                        <span className="display-inline width-142 text-overflow-ellipsis">{i18n._('key-settings/Add Material')}</span>
                    </Button>
                </div>
            </div>
            <div>
                {Object.keys(definitionByCategory).map(key => {
                    return (
                        <Anchor onClick={() => setActiveCategory(key)} className="margin-top-36 display-block">
                            <div className="sm-flex align-center">
                                <CaretRightOutlined rotate={activeCategory === key ? 90 : 0} />
                                <div className="margin-left-12 heading-3">{i18n._(definitionByCategory[key][0].i18nCategory)}</div>
                            </div>
                            <div className={`${activeCategory === key ? 'sm-grid grid-template-columns-for-material-settings grid-row-gap-16 grid-column-gap-32' : 'display-none'}`}>
                                {
                                    definitionByCategory[key].map(definition => {
                                        const selectedDefinitionId = activeNozzle === LEFT ? leftMaterialDefinitionId : rightMaterialDefinitionId;
                                        return (
                                            <Anchor
                                                className={`height-40 border-radius-100 padding-horizontal-16 sm-flex align-center border-default-grey-1 ${selectedDefinitionId === definition.definitionId ? 'border-blod-blue-2' : ''}`}
                                                onClick={() => handleUpdateDefinition(definition.definitionId)}
                                            >
                                                <div className="width-16 height-16 border-default-grey-1 margin-right-8 " style={{ background: `${definition?.settings?.color?.default_value}` }} />
                                                <span>{i18n._(definition.i18nName)}</span>
                                            </Anchor>
                                        );
                                    })
                                }
                            </div>
                        </Anchor>
                    );
                })}
            </div>
            {showCreateMaterialModal && (
                <AddMaterialModel
                    setShowCreateMaterialModal={setShowCreateMaterialModal}
                />
            )}
        </div>
    );
};

export default MaterialSettings;
