import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { find } from 'lodash';
import styles from './styles/maintoolbar.styl';
import MenuItem from './MenuItem';
import { Badge } from '../components/Badge';
import Anchor from '../components/Anchor';
import i18n from '../../lib/i18n';
import { HEAD_PRINTING, MACHINE_SERIES, WHITE_COLOR } from '../../constants';
// import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, MACHINE_TOOL_HEADS, MACHINE_SERIES, WHITE_COLOR } from '../../constants';
import SvgIcon from '../components/SvgIcon';

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
                        if (menuItem.children) {
                            return (
                                <span
                                    key={key++}
                                    className={classNames(
                                        menuItem.className ? menuItem.className : '',
                                        'display-inline'
                                    )}
                                >
                                    {menuItem.children.map((childItem) => {
                                        return (<MenuItem key={childItem.name + (key++)} menuItem={childItem} actions={actions} lang={lang} headType={headType} />);
                                    })}
                                </span>
                            );
                        } else if (menuItem) {
                            return <MenuItem key={key++} menuItem={menuItem} actions={actions} lang={lang} headType={headType} />;
                        }
                        return null;
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
                        <div className={classNames(styles['hover-background'], 'print-machine-material-intro machine-setting position-re width-360 float-r border-left-grey-3 height-66 sm-flex sm-flex-direction-c justify-space-between padding-vertical-8 padding-horizontal-16')}>
                            <div className="width-144">
                                <div className="width-144 sm-flex">
                                    <Badge status={isConnected ? 'success' : 'default'} />
                                    <span className="width-130 text-overflow-ellipsis display-inline">{i18n._(find(MACHINE_SERIES, { value: machineInfo?.series })?.seriesLabel)}</span>
                                </div>
                            </div>
                            {headType === HEAD_PRINTING && (
                                <div className="width-percent-100 sm-flex">
                                    <div className="sm-flex width-percent-50 text-overflow-ellipsis">
                                        {/* <div className="height-24 width-24 border-default-grey-1" style={{ borderColor: `${materialInfo?.leftExtruder?.color}`, backgroundColor: `${materialInfo?.leftExtruder?.color}` }} /> */}
                                        {materialInfo?.leftExtruder?.color === WHITE_COLOR ? (
                                            <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                                        ) : (
                                            <SvgIcon
                                                // name={`${materialInfo?.leftExtruder?.color === WHITE_COLOR ? 'ExtruderWhite' : 'Extruder'}`}
                                                name="Extruder"
                                                size={24}
                                                color={materialInfo?.leftExtruder?.color}
                                                type={['static']}
                                            />
                                        )}
                                        {materialInfo?.rightExtruder && (
                                            <div className="margin-right-4">L:</div>
                                        )}
                                        <span className="display-inline text-overflow-ellipsis">{materialInfo?.leftExtruder?.name}</span>
                                    </div>
                                    {materialInfo?.rightExtruder && (
                                        <div className="sm-flex width-percent-50 text-overflow-ellipsis">
                                            {materialInfo?.rightExtruder?.color === WHITE_COLOR ? (
                                                <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                                            ) : (
                                                <SvgIcon
                                                    name="Extruder"
                                                    size={24}
                                                    color={materialInfo?.rightExtruder?.color}
                                                    type={['static']}
                                                />
                                            )}
                                            <div className="margin-right-4">R:</div>
                                            <span className="display-inline text-overflow-ellipsis">{materialInfo?.rightExtruder?.name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {headType === HEAD_PRINTING && (
                                <SvgIcon
                                    name="RightSlipNormal"
                                    size={24}
                                    type={['static']}
                                    className="position-ab top-22 right-16"
                                />
                            )}
                        </div>
                    </Anchor>
                )}
            </div>
        );
    }
}

export default MainToolBar;
