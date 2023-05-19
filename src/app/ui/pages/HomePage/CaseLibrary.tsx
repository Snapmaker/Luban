import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import isElectron from 'is-electron';
import { Anchor, Spin } from 'antd';
import i18n from '../../../lib/i18n';
import { timestamp } from '../../../../shared/lib/random-utils';
import styles from './styles.styl';
import QuickStart from './QuickStart';
import api from '../../../api';
import { MACHINE_SERIES, isDualExtruder } from '../../../constants/machines';
import { actions as appGlobalActions } from '../../../flux/app-global';
import { CaseConfigQuickStart } from './CaseConfig';
import { renderModal } from '../../utils';
import { DetailModalState, resourcesDomain, IMG_RESOURCE_BASE_URL, AccessResourceWebState } from '../../../constants/downloadManager';
import { RootState } from '../../../flux/index.def';

const CaseLibrary = (props) => {
    // useState
    const [canAccessInternet, setCanAccessInternet] = useState(false);
    const [showCaseResource, setShowCaseResource] = useState(false);
    const [caseConfig, setCaseConfig] = useState([]);
    const [showQuickStartModal, setShowQuickStartModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);


    // redux correlation
    const dispatch = useDispatch();
    const series = useSelector((state: RootState) => state?.machine?.series);
    const toolHead = useSelector((state: RootState) => state?.machine?.toolHead);
    const canAccessWeb: AccessResourceWebState = useSelector((state: RootState) => state?.appGlobal?.canAccessWeb);

    const renderQuickStartModal = () => {
        const onClose = () => setShowQuickStartModal(false);
        return renderModal({
            title: i18n._('key-HomePage/Begin-Case Library'),
            renderBody: () => {
                return <QuickStart history={props.history} noTitle />;
            },
            size: 'small',
            onClose,
            actions: []
        });
    };
    const loadData = async () => {
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
        const isShow = canAccessInternet && isCaseResourceMachine(series, toolHead) && isElectron();
        setIsLoading(true);
        if (!isShow) return isShow;
        const res = await api.getCaseResourcesList();
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return false;
        }
        const caseList = res.body.data.map(caseItem => {
            return {
                id: caseItem.id,
                title: caseItem.name,
                author: caseItem.author || 'snapmaker',
                imgSrc: `${IMG_RESOURCE_BASE_URL}${caseItem.coverImageUrl}`
            };
        });
        setCaseConfig([CaseConfigQuickStart].concat(caseList));
        return true;
    };
    const onClick = (caseItem, isLast) => {
        if (!caseItem) return;

        const goCaseResource = (id) => {
            if (isElectron()) {
                dispatch(appGlobalActions.updateState({ showCaseResource: true, caseResourceId: id }));
            }
        };

        if (isLast) {
            goCaseResource(DetailModalState.Close);
            return;
        }
        if (caseItem.id) {
            // caseItem.id existing means this is a online case reources
            goCaseResource(caseItem.id);
        } else {
            // or it just is quick start(open locale case libary)
            setShowQuickStartModal(true);
        }
    };

    //  useEffect
    useEffect(() => {
        let isMounted = true;

        //  method
        // test access of iframe src by path /access-test.css.
        // Front end should provid this file in server
        const accessTest = async (cb?: Function) => new Promise((resolve) => {
            if (canAccessWeb !== AccessResourceWebState.INITIAL) {
                resolve(canAccessWeb);
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${resourcesDomain}/access-test.css`;
            link.onerror = () => {
                cb && cb();
                dispatch(appGlobalActions.updateState({ canAccessWeb: AccessResourceWebState.BLOCKED }));
                resolve(AccessResourceWebState.BLOCKED);
                document.head.removeChild(link);
            };
            link.onload = () => {
                dispatch(appGlobalActions.updateState({ canAccessWeb: AccessResourceWebState.PASS }));
                resolve(AccessResourceWebState.PASS);
                document.head.removeChild(link);
            };
            document.head.appendChild(link);

            // timeout
            setTimeout(() => {
                document.head.removeChild(link);
                resolve(false);
            }, 2000);
        });

        Promise.all([accessTest(), loadData()])
            .then(([accessedWeb, isShow]) => { isMounted && setShowCaseResource(accessedWeb === AccessResourceWebState.PASS && isShow); })
            .catch(err => console.error(err))
            .finally(() => { setIsLoading(false); });
        return () => {
            isMounted = false;
        };
    }, []);

    // test Internet status
    useEffect(() => {
        // TODO: it is better to handler in node by dns check
        setCanAccessInternet(window.navigator.onLine);
        const onlineHandler = () => setCanAccessInternet(true);
        const offlineHandler = () => setCanAccessInternet(false);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        return () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        };
    });

    useEffect(() => {
        loadData()
            .then((isShow) => setShowCaseResource(canAccessWeb === AccessResourceWebState.PASS && isShow))
            .finally(() => { setIsLoading(false); });
    }, [series, toolHead, canAccessInternet, canAccessWeb]);

    return (
        <>
            {showCaseResource
                && (
                    <div className={styles['resources-container']}>
                        <div className={classNames(styles['title-label'], 'highlight-heading', 'margin-bottom-16')}>
                            {i18n._('key-HomePage/CaseLibrary')}
                        </div>
                        <Spin spinning={isLoading}>
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
                                                    {/* <div className={classNames(styles['case-author'])}>
                                                        @{i18n._(caseItem.author)}
                                                    </div> */}
                                                    <div className={classNames(styles['case-title'])}>
                                                        {i18n._(caseItem.title)}
                                                    </div>
                                                </div>
                                            </div>
                                            {isLast && (
                                                <div className={classNames(styles['case-more'])}>
                                                    <Anchor className={classNames(styles['case-resource'])}>
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
                        </Spin>
                    </div>
                )}
            {!showCaseResource && <QuickStart history={props.history} />}
            {showQuickStartModal && renderQuickStartModal()}
        </>
    );
};

CaseLibrary.propTypes = {
    history: PropTypes.object
};

export default CaseLibrary;
