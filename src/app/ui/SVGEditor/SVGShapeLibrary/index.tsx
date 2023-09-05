import React, { useEffect, useRef, useState } from 'react';
import i18next from 'i18next';
import { Checkbox, Spin, Pagination } from 'antd';
import classNames from 'classnames';
import _ from 'lodash';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';
import styles from './styles.styl';
import api from '../../../api';
import MainToolBar from '../../layouts/MainToolBar';
import i18n from '../../../lib/i18n';
import { IMG_RESOURCE_BASE_URL } from '../../../constants/downloadManager';


const SVGShapeLibrary = (props) => {
    const rightSideBlock = useRef();
    const [svgShapeCount, setSvgShapeCount] = useState(0);
    const [pageSize, setPageSize] = useState(4 * 5);
    const [page, setPage] = useState(1);
    const mainToolBarId = 'svg-shape-library-main-tool-bar';
    const [isLoading, setIsLoading] = useState(true);
    const [svgList, setSvgList] = useState([]);
    const [labelList, setLabelList] = useState([]);
    const [selectedLabelList, setSelectedLabelList] = useState([]);

    const [indeterminate, setIndeterminate] = useState(false);
    const [checkAll, setCheckAll] = useState(false);

    const getLabelList = async (query?: {labelIds?: number[]}) => {
        const res = (await api.getSvgShapeLabelList(query)) as any;
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return [];
        }
        const data = res.body.data;
        setLabelList(data);
        return data;
    };

    const getSvgList = async (query?: {labelIds?: number[], pageSize?: number, page?:number, start?: number, size?: number}) => {
        setIsLoading(true);
        if (query && Array.isArray(query.labelIds) && query.labelIds.includes(0)) query = null;
        const res = (await api.getSvgShapeList(query)) as any;
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return [];
        }
        const data = res.body.data;
        res.body.total > 0 && setSvgShapeCount(res.body.total);
        // svgList.concat(data);
        setSvgList(data);
        setIsLoading(false);
        return data;
    };

    const onCheckAllChange = (e: CheckboxChangeEvent) => {
        setSelectedLabelList(e.target.checked ? labelList.map(v => v.id) : []);
        setIndeterminate(false);
        setCheckAll(e.target.checked);
        getSvgList({ labelIds: e.target.checked ? labelList.map(v => v.id) : [], pageSize, page });
    };

    const onClickSvg = (svgShape) => {
        setIsLoading(true);
        if (svgShape.pathData) {
            props.createSvgModelByDData(svgShape.pathData);
            setIsLoading(false);
        } else {
            fetch(IMG_RESOURCE_BASE_URL + svgShape.fileInfo.file.uploadPath)
                .then(async response => response.blob())
                .then(async svgBlob => {
                    // set width and height
                    const svgString = await svgBlob.text();
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;
                    if (svgElement.hasAttribute('viewBox')) {
                        const w = parseFloat(svgElement.getAttribute('width'));
                        const h = parseFloat(svgElement.getAttribute('height'));
                        console.log(w, h);
                        if (h > w) {
                            const scaled = 100 * (w / h);
                            svgElement.setAttribute('width', scaled.toString());
                            svgElement.setAttribute('height', '100');
                            // changeHeight(100);
                        } else {
                            const scaled = 100 * (h / w);
                            svgElement.setAttribute('width', '100');
                            svgElement.setAttribute('height', scaled.toString());
                            // changeWidth(100);
                        }
                    }
                    const blob = new Blob([new XMLSerializer().serializeToString(svgElement)]);

                    const svgFile = new File([blob], `${svgShape.name}.svg`, { type: 'image/svg+xml' });
                    await props.onChangeFile({ target: { files: [svgFile] } });

                    // setIsLoading(false);
                });
        }
        props.onClose();
        setIsLoading(false);
    };

    const onChange = (checkedValues: number[]) => {
        if (checkedValues.includes(0)) {
            setSelectedLabelList(labelList);
        }
        const sortedCheckedValues = checkedValues.sort((a, b) => a - b);
        if (_.isEqual(selectedLabelList, sortedCheckedValues)) return;
        setIndeterminate(!!sortedCheckedValues.length && sortedCheckedValues.length < labelList.length);
        setSelectedLabelList(sortedCheckedValues);
        getSvgList({ labelIds: checkedValues, pageSize: pageSize });
        setCheckAll(sortedCheckedValues.length === labelList.length);
    };

    const onPageChange = (toPage: number, toPageSize: number) => {
        setPage(toPage);
        setPageSize(toPageSize);
        getSvgList({ labelIds: selectedLabelList, page: toPage, pageSize: toPageSize });
    };
    const handleResize = (() => {
        return _.debounce(() => {
            if (!window || !rightSideBlock?.current) return window.innerWidth >= 1920 ? 8 * 4 : 5 * 4;
            const width = rightSideBlock?.current?.clientWidth;
            // const height = rightSideBlock?.current.clientHeight;
            const height = window.innerHeight - 26 - 68 - 80; // menu-bar(26) and modal-bar(68) and pagination(80)
            const col = window.innerWidth >= 1920 ? 8 : 5;
            const itemWidth = (width - col * 10) / col;
            const itemHeight = itemWidth;
            const row = Math.floor(height / itemHeight);
            const currPageSize = col * row;
            const currpage = Math.floor((pageSize * page) / currPageSize);
            getSvgList({ labelIds: selectedLabelList, page: currpage || 1, pageSize: currPageSize });
            return currPageSize;
        }, 500);
    })();

    useEffect(() => {
        getLabelList();

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <Spin spinning={isLoading}>
            <div className={styles['svg-shape-wrapper']}>
                <MainToolBar
                    wrapID={mainToolBarId}
                    leftItems={[
                        {
                            title: i18n._('key-SvgShapeLibrary/Page-Back'),
                            name: 'MainToolbarBack',
                            action: () => (props?.isPopup ? props.onClose() : props.history.push('/home')),
                        },
                    ]}
                    mainBarClassName="background-transparent"
                    lang={i18next.language}
                    className={styles['svg-shape-maintoolbar']}
                />
                <div className={styles['svg-shape-content-wrapper']}>
                    <div id="svg-shape-library" className={styles['svg-shape-content']}>
                        <div className={styles['svg-shape-leftside']}>
                            <h1>{i18n._('key-SvgShapeLibrary/Category')}</h1>
                            <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                                {i18n._('key-SvgShapeLibrary/All')}
                            </Checkbox>
                            <Checkbox.Group style={{ width: '100%' }} className={styles['svg-shape-checkbox-group']} onChange={onChange} value={selectedLabelList}>
                                {
                                    labelList.map(label => {
                                        return (<Checkbox key={`label${label.id}`} value={label.id} className={styles['svg-shape-checkbox']}>{label.name}</Checkbox>);
                                    })
                                }
                            </Checkbox.Group>
                        </div>
                        <div className={styles['svg-shape-rightside']} ref={rightSideBlock}>
                            <div className={styles['svg-shape-container']}>
                                {
                                    svgList.map(v => {
                                        if (v.pathData) {
                                            return (
                                                <div className={styles['svg-shape-item']}>
                                                    <svg
                                                        onClick={() => onClickSvg(v)}
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        role="button"
                                                        viewBox="0 0 300 300"
                                                        style={{ background: 'transparent', 'borderBottom': 0 }}
                                                        fill="#545659"
                                                        className={
                                                            classNames('background-transparent',
                                                                'padding-horizontal-4', 'position-re',
                                                                styles['btn-center-ext'],)
                                                        }
                                                    >
                                                        <path stroke="black" fill="none" strokeWidth="6.25" fillRule="evenodd" clipRule="evenodd" d={v.pathData} />
                                                    </svg>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div
                                                    tabIndex={0}
                                                    className={styles['svg-shape-item']}
                                                    role="button"
                                                    onKeyDown={() => onClickSvg(v)}
                                                    onClick={() => onClickSvg(v)}
                                                >
                                                    <img
                                                        className="width-percent-100"
                                                        src={IMG_RESOURCE_BASE_URL + v.fileInfo.file.uploadPath}
                                                        alt=""
                                                    />
                                                </div>
                                            );
                                        }
                                    })
                                }

                            </div>
                            <Pagination
                                className={styles.pagination}
                                defaultCurrent={page}
                                total={svgShapeCount}
                                showSizeChanger={false}
                                defaultPageSize={pageSize}
                                pageSize={pageSize}
                                onChange={onPageChange}
                                current={page}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Spin>
    );
};

export default SVGShapeLibrary;
