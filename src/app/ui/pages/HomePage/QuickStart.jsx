import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { getCaseList } from '../../../lib/caseLibrary';
import { timestamp } from '../../../../shared/lib/random-utils';
import { actions as projectActions } from '../../../flux/project';
import styles from './styles.styl';

const QuickStart = (props) => {
    const { history, noTitle } = props;
    // useState
    const [caseConfig, setCaseConfig] = useState([]);
    const [caseConfigFourAxis, setCaseConfigFourAxis] = useState([]);

    // redux correlation
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const use4Axis = useSelector(state => state?.machine?.use4Axis);
    const { opening: openingProject } = useSelector(state => state?.project?.general);
    const dispatch = useDispatch();

    //  method
    const loadCase = useCallback((caseItem) => {
        if (openingProject) {
            return;
        }
        log.info('Open project...');
        dispatch(projectActions.openProject(caseItem.pathConfig, history));
    }, [dispatch, openingProject, history]);


    //  useEffect
    useEffect(() => {
        const { caseList, caseListFourAxis } = getCaseList(series, toolHead);
        setCaseConfig(caseList);
        setCaseConfigFourAxis(caseListFourAxis);
    }, []);

    useEffect(() => {
        const { caseList, caseListFourAxis } = getCaseList(series, toolHead);
        setCaseConfig(caseList);
        setCaseConfigFourAxis(caseListFourAxis);
    }, [series, toolHead]);

    return (
        <div className={styles['quick-start-container']}>
            {!noTitle && (
                <div className={classNames(styles['title-label'], 'highlight-heading', 'margin-bottom-16')}>
                    {i18n._('key-HomePage/CaseLibrary-Quick Start')}
                </div>
            )}
            <div className={
                classNames(
                    styles['case-list'],
                    { [styles.smallList]: !caseConfigFourAxis.length }
                )
            }
            >
                {caseConfig.map(caseItem => {
                    return (
                        <div
                            key={caseItem.pathConfig.name + timestamp()}
                            className={styles['case-item']}
                            aria-hidden="true"
                            onClick={() => loadCase(caseItem)}
                        >
                            <div>
                                <div className={styles.imgWrapper}>
                                    <img className={styles['case-img']} src={caseItem.imgSrc} alt="" />
                                </div>
                            </div>
                            <div className={classNames(styles.caseText)}>
                                <div className={classNames(styles['case-title'], 'heading-3', 'text-overflow-ellipsis-line-2')}>
                                    {i18n._(caseItem.title)}
                                </div>
                                <div className={classNames('disabled-text')}>
                                    <span className="text-overflow-ellipsis display-inline width-percent-100">{i18n._(caseItem.tag_i18n)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {use4Axis && caseConfigFourAxis?.map(caseFourAxisItem => {
                    return (
                        <div
                            key={caseFourAxisItem.pathConfig.name + timestamp()}
                            className={styles['case-item']}
                            aria-hidden="true"
                            onClick={() => loadCase(caseFourAxisItem)}
                        >
                            <div>
                                <div className={styles.imgWrapper}>
                                    <img className={styles['case-img']} src={caseFourAxisItem.imgSrc} alt="" />
                                </div>
                            </div>
                            <div className={classNames(styles.caseText)}>
                                <div className={classNames(styles['case-title'], 'heading-3', 'text-overflow-ellipsis-line-2')}>
                                    {i18n._(caseFourAxisItem.title)}
                                </div>
                                <div className={classNames('disabled-text')}>
                                    {/* <span style={{ paddingRight: 2 }}>{i18n._('key-HomePage/Begin-4-axis')}</span>
                                    <span>{i18n._(caseFourAxisItem.tag_i18n)}</span> */}
                                    <span className="text-overflow-ellipsis display-inline width-percent-100">{`${i18n._('key-HomePage/Begin-4-axis')} ${i18n._(caseFourAxisItem.tag_i18n)}`}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

QuickStart.propTypes = {
    history: PropTypes.object,
    noTitle: PropTypes.bool
};

export default QuickStart;
