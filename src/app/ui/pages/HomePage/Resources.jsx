import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import isElectron from 'is-electron';
import { Anchor } from 'antd';
import i18n from '../../../lib/i18n';
import { timestamp } from '../../../../shared/lib/random-utils';
import styles from './styles.styl';
import QuickStart from './QuickStart';
import api from '../../../api';
import { MACHINE_SERIES, isDualExtruder } from '../../../constants/machines';
import { actions as appGlobalActions } from '../../../flux/app-global';
import { CaseConfigQuickStart } from './CaseConfig';
import { renderModal } from '../../utils';
import { DetailModalState } from '../../../constants/downloadManager';

const Resources = (props) => {
    // useState
    const [canAccessInternet, setCanAccessInternet] = useState(false);
    const [showCaseResource, setShowCaseResource] = useState(false);
    const [caseConfig, setCaseConfig] = useState([]);
    const [showQuickStartModal, setShowQuickStartModal] = useState(false);

    // redux correlation
    const dispatch = useDispatch();
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);

    //  method
    const renderQuickStartModal = () => {
        const onClose = () => setShowQuickStartModal(false);
        return renderModal({
            title: i18n._('key-HomePage/Begin-Case Library'),
            renderBody: () => {
                return <QuickStart history={props.history} noTitle />;
            },
            renderFooter: () => { },
            size: 'small',
            onClose,
            actions: []
        });
    };
    const linstenNetworkConnect = () => {
        // TODO: it is better to handler in node by dns check, for now that is good
        setCanAccessInternet(window.navigator.onLine);
        const onlineHandler = () => setCanAccessInternet(true);
        const offlineHandler = () => setCanAccessInternet(false);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        return () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        };
    };
    const isCaseResourceMachine = (currSeries, currToolHead) => {
        const isDual = isDualExtruder(currToolHead.printingToolhead);
        if (
            (currSeries === MACHINE_SERIES.A150.identifier && isDual)
            || (currSeries === MACHINE_SERIES.A250.identifier && isDual)
            || (currSeries === MACHINE_SERIES.A350.identifier && isDual)
            || currSeries === MACHINE_SERIES.A400.identifier || currSeries === MACHINE_SERIES.J1.identifier
        ) {
            return true;
        } else {
            return false;
        }
    };
    const loadData = () => {
        const isShow = canAccessInternet && isCaseResourceMachine(series, toolHead);
        setShowCaseResource(isShow);
        isShow && api.getCaseResourcesList().then(
            (res) => {
                if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
                    setShowCaseResource(false);
                    return;
                }
                const caseList = res.body.data.map(caseItem => {
                    const IMG_RESOURCE_BASE_URL = 'https://d3gw8b56b7j3w6.cloudfront.net/';
                    return {
                        id: caseItem.id,
                        title: caseItem.name,
                        author: caseItem.author || 'snapmaker',
                        imgSrc: `${IMG_RESOURCE_BASE_URL}${caseItem.coverImageUrl}`
                    };
                });
                setCaseConfig([CaseConfigQuickStart].concat(caseList));
            }
        );
    };
    const goCaseResource = (id) => {
        if (isElectron()) {
            dispatch(appGlobalActions.updateState({ showCaseResource: true, caseResourceId: id }));
        }
    };
    const onClick = (caseItem, isLast) => {
        if (!caseItem) return;
        if (isLast) {
            goCaseResource(DetailModalState.Close);
            return;
        }
        if (caseItem.id) {
            // caseItem.id existing means this is a online case reources
            goCaseResource(caseItem.id);
        } else {
            // or it just is quick (open locale case libary)
            setShowQuickStartModal(true);
        }
    };

    //  useEffect
    useEffect(() => {
        const removelinstener = linstenNetworkConnect();
        loadData();
        return () => removelinstener();
    }, []);

    useEffect(() => {
        loadData();
    }, [series, toolHead, canAccessInternet]);

    return (
        <>
            {showCaseResource
                && (
                    <div className={styles['resources-container']}>
                        <div className={classNames(styles['title-label'], 'highlight-heading', 'margin-bottom-16')}>
                            {i18n._('key-HomePage/Resources Resources')}
                        </div>
                        <div className={classNames(styles['case-list'], styles.smallList)}>
                            {caseConfig.map((caseItem, index) => {
                                const isLast = index === caseConfig.length - 1;
                                return (
                                    <div
                                        key={caseItem.title + timestamp()}
                                        className={styles['case-item']}
                                        aria-hidden="true"
                                        onClick={() => { onClick(caseItem, isLast); }}
                                    >
                                        <div className={styles.imgWrapper}>
                                            <img className={styles['case-img']} src={caseItem.imgSrc} alt="" />
                                            <div className={classNames(styles.caseText)}>
                                                <div className={classNames(styles['case-author'])}>
                                                    @{i18n._(caseItem.author)}
                                                </div>
                                                <div className={classNames(styles['case-title'])}>
                                                    {i18n._(caseItem.title)}
                                                </div>
                                            </div>
                                        </div>
                                        {isLast && (
                                            <div className={classNames(styles['case-more'])}>
                                                <Anchor title={i18n._('key-HomePage/Begin-Workspace')} className={classNames(styles['case-resource'])}>
                                                    <span className={classNames('color-blue-2 ', 'heading-3-normal-with-hover')}>
                                                        {i18n._('key-HomePage/CaseResource-More')} {'>'}
                                                    </span>
                                                </Anchor>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            {!showCaseResource && <QuickStart history={props.history} />}
            {showQuickStartModal && renderQuickStartModal()}
        </>
    );
};

Resources.propTypes = {
    history: PropTypes.object
};

export default Resources;
