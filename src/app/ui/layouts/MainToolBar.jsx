import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { find } from 'lodash';
import styles from './styles/maintoolbar.styl';
import MenuItem from './MenuItem';
import { Badge } from '../components/Badge';
import Anchor from '../components/Anchor';
import i18n from '../../lib/i18n';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, MACHINE_BRAND_MAP, MACHINE_TOOL_HEADS, MACHINE_SERIES } from '../../constants';
import SvgIcon from '../components/SvgIcon';
// import { timestamp } from '../../../shared/lib/random-utils';

class MainToolBar extends PureComponent {
    static propTypes = {
        leftItems: PropTypes.array,
        // centerItems: PropTypes.array,
        // rightItems: PropTypes.array,
        mainBarClassName: PropTypes.string,
        lang: PropTypes.string,
        headType: PropTypes.string,
        profileInitialized: PropTypes.bool,
        hasMachineSettings: PropTypes.bool,
        machineInfo: PropTypes.object,
        isConnected: PropTypes.bool,
        materialInfo: PropTypes.object,
        setShowMachineMaterialSettings: PropTypes.func
    };


    state = {
    };

    actions = {
        handleClick: (callback) => {
            try {
                callback && callback();
            } catch (e) {
                console.error(e);
            }
        }
    }


    render() {
        const actions = this.actions;
        const { setShowMachineMaterialSettings, leftItems, mainBarClassName, lang, headType, hasMachineSettings, machineInfo, isConnected, materialInfo } = this.props;
        let key = 0;
        return (
            <div
                className={classNames(
                    'clearfix',
                    styles['bar-wrapper'],
                    mainBarClassName || ''
                )}
            >
                <div
                    className={classNames(
                        styles.left,
                        styles['bar-item'],
                        'white-space-nowrap'
                    )}
                >
                    {leftItems && (leftItems.filter(item => item).map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} headType={headType} />;
                    }))}
                </div>
                {/* <div className={styles['bar-item']}>
                    {centerItems && (centerItems.map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} headType={headType} />;
                    }))}
                </div>
                <div
                    className={classNames(
                        styles.right,
                        styles['bar-item']
                    )}
                >
                    {rightItems && (rightItems.map((menuItem) => {
                        return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} />;
                    }))}
                </div> */}
                {hasMachineSettings && (
                    <Anchor
                        onClick={() => (headType === HEAD_PRINTING ? setShowMachineMaterialSettings(true) : null)}
                        key="machineMaterialSettings"
                        disabled={!this.props.profileInitialized}
                    >
                        <div className="machine-setting width-360 background-grey-3 height-50 float-r border-radius-8 sm-flex justify-space-between padding-vertical-4 padding-horizontal-8">
                            <div className="width-144">
                                <div className="width-144 sm-flex">
                                    <Badge status={isConnected ? 'success' : 'default'} />
                                    <span className="width-130 text-overflow-ellipsis display-inline">{i18n._(find(MACHINE_SERIES, { value: machineInfo?.series })?.seriesLabel)}</span>
                                </div>
                                <div className="margin-left-14 opacity-precent-50">
                                    {i18n._(`key-Luban/Machine/Brand-${MACHINE_BRAND_MAP[machineInfo.series]}`)}
                                </div>
                            </div>
                            {headType === HEAD_PRINTING && (
                                <div className="width-192 sm-flex sm-flex-direction-c">
                                    <div className="sm-flex">
                                        {/* <div className="height-24 width-24 border-default-grey-1" style={{ borderColor: `${materialInfo?.leftExtruder?.color}`, backgroundColor: `${materialInfo?.leftExtruder?.color}` }} /> */}
                                        <div className="position-re">
                                            <SvgIcon
                                                name="Extruder"
                                                size={24}
                                                color={materialInfo?.leftExtruder?.color}
                                                type={['static']}
                                            />
                                            {materialInfo?.rightExtruder && (
                                                <div className={classNames(materialInfo?.leftExtruder?.color === '#ffffff' ? 'color-black-3' : 'color-white', 'position-ab left-10 top-2 font-size-small')}>L</div>
                                            )}
                                        </div>
                                        <span className="max-width-160 display-inline text-overflow-ellipsis">{materialInfo?.leftExtruder?.name}</span>
                                    </div>
                                    {materialInfo?.rightExtruder && (
                                        <div className="sm-flex">
                                            <div className="position-re">
                                                <SvgIcon
                                                    name="Extruder"
                                                    size={24}
                                                    color={materialInfo?.rightExtruder?.color}
                                                    type={['static']}
                                                />
                                                <div className={classNames(materialInfo?.rightExtruder?.color === '#ffffff' ? 'color-black-3' : 'color-white', 'position-ab left-10 top-2 font-size-small')}>R</div>
                                            </div>
                                            <span className="max-width-160 display-inline text-overflow-ellipsis">{materialInfo?.rightExtruder?.name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {(headType === HEAD_CNC || headType === HEAD_LASER) && (
                                <div className="width-192">
                                    <div className="sm-flex">
                                        <SvgIcon
                                            name="Extruder"
                                            size={24}
                                            type={['static']}
                                        />
                                        <span>{i18n._(`${MACHINE_TOOL_HEADS[machineInfo?.toolHead].label}`)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Anchor>
                )}
            </div>
        );
    }
}

export default MainToolBar;
