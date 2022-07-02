import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from './styles/maintoolbar.styl';
import MenuItem from './MenuItem';
import { Badge } from '../components/Badge';
import Anchor from '../components/Anchor';
import i18n from '../../lib/i18n';
// import { timestamp } from '../../../shared/lib/random-utils';

class MainToolBar extends PureComponent {
    static propTypes = {
        leftItems: PropTypes.array,
        // centerItems: PropTypes.array,
        // rightItems: PropTypes.array,
        mainBarClassName: PropTypes.string,
        lang: PropTypes.string,
        headType: PropTypes.string,
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
                    {leftItems && (leftItems.map((menuItem) => {
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
                    <Anchor onClick={() => setShowMachineMaterialSettings(true)} key="machineMaterialSettings">
                        <div className="machine-setting width-360 background-grey-3 height-50 float-r border-radius-8 sm-flex justify-space-between padding-vertical-4 padding-horizontal-8">
                            <div className="width-144">
                                <div className="width-144 sm-flex">
                                    <Badge status={isConnected ? 'success' : 'default'} />
                                    <span className="width-130 text-overflow-ellipsis display-inline">{i18n._(`key-Luban/Machine/MachineSeries-Snapmaker 2.0 ${machineInfo?.series}`)}</span>
                                </div>
                            </div>
                            <div className="width-192 sm-flex sm-flex-direction-c">
                                <div className="sm-flex">
                                    <div className="height-24 width-24 border-default-grey-1" style={{ borderColor: `${materialInfo?.leftExtruder?.color}`, backgroundColor: `${materialInfo?.leftExtruder?.color}` }} />
                                    <span className="max-width-160 display-inline text-overflow-ellipsis">{materialInfo?.leftExtruder?.name}</span>
                                </div>
                                {materialInfo?.rightExtruder && (
                                    <div className="sm-flex">
                                        <div className="height-24 width-24 border-default-grey-1" style={{ borderColor: `${materialInfo?.rightExtruder?.color}`, backgroundColor: `${materialInfo?.rightExtruder?.color}` }} />
                                        <span className="max-width-160 display-inline text-overflow-ellipsis">{materialInfo?.rightExtruder?.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Anchor>
                )}
            </div>
        );
    }
}

export default MainToolBar;
