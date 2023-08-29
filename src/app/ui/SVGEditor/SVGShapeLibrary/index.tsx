import React, { useEffect, useState } from 'react';
import i18next from 'i18next';
import { Checkbox, Spin, Pagination } from 'antd';
import classNames from 'classnames';
import _ from 'lodash';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';
import 'react-virtualized/styles.css'; // only needs to be imported once
import styles from './styles.styl';
import api from '../../../api';
import MainToolBar from '../../layouts/MainToolBar';
import i18n from '../../../lib/i18n';
import { IMG_RESOURCE_BASE_URL } from '../../../constants/downloadManager';

const SVGShapeLibrary = (props) => {
    // const [colCount, setColCount] = useState(5);
    // const colCount = 5;
    const [svgShapeCount, setSvgShapeCount] = useState(0);
    const [pageSize, setPageSize] = useState(20);
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
        console.log('res', res);
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return [];
        }
        const data = res.body.data;
        console.log(data);
        setLabelList(data);
        return data;
    };
    const getSvgList = async (query?: {labelIds?: number[], pageSize?: number, page?:number, start?: number, size?: number}) => {
        setIsLoading(true);
        if (query && Array.isArray(query.labelIds) && query.labelIds.includes(0)) query = null;
        const res = (await api.getSvgShapeList(query)) as any;
        // console.log('res', res);
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return [];
        }
        const data = res.body.data;
        res.body.total > 0 && setSvgShapeCount(res.body.total);
        svgList.concat(data);
        console.log(`total: ${svgShapeCount}`);
        // setSvgList(pre => [...pre, ...data]);
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
                .then(svgBlob => {
                    const svgFile = new File([svgBlob], `${svgShape.name}.svg`, { type: 'image/svg+xml' });
                    console.log('$svgFile', svgFile);
                    props.onChangeFile({ target: { files: [svgFile] } });
                    setIsLoading(false);
                });
        }
        props.onClose();
    };

    // CheckboxValueType
    const onChange = (checkedValues: number[]) => {
        if (checkedValues.includes(0)) {
            setSelectedLabelList(labelList);
        }
        const sortedCheckedValues = checkedValues.sort((a, b) => a - b);
        if (_.isEqual(selectedLabelList, sortedCheckedValues)) return;
        console.log('checked = ', sortedCheckedValues, selectedLabelList);
        setIndeterminate(!!sortedCheckedValues.length && sortedCheckedValues.length < labelList.length);
        setSelectedLabelList(sortedCheckedValues);
        getSvgList({ labelIds: checkedValues, pageSize: pageSize });
        setCheckAll(sortedCheckedValues.length === labelList.length);
    };

    const onPageChange = (toPage: number, toPageSize: number) => {
        console.log('$', page, pageSize);
        setPage(toPage);
        setPageSize(toPageSize);
        getSvgList({ labelIds: selectedLabelList, page: toPage, pageSize: toPageSize });
    };

    useEffect(() => {
        getLabelList();

        // get total svgshape
        getSvgList({ pageSize, page });
        console.log(setPageSize, setPage);
    }, []);

    return (
        <Spin spinning={isLoading}>
            <div className={styles['svg-shape-wrapper']}>
                <MainToolBar
                    wrapID={mainToolBarId}
                    leftItems={[
                        {
                            title: i18n._('key-CaseResource/Page-Back'),
                            name: 'MainToolbarBack',
                            action: () => (props?.isPopup ? props.onClose() : props.history.push('/home')),
                        },
                    ]}
                    mainBarClassName="background-transparent"
                    lang={i18next.language}
                    className={styles['svg-shape-maintoolbar']}
                />
                <div id="svg-shape-library" className={styles['svg-shape-content']}>
                    <div className={styles['svg-shape-leftside']}>
                        <h1>Category</h1>
                        <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                            All
                        </Checkbox>
                        <Checkbox.Group style={{ width: '100%' }} className={styles['svg-shape-checkbox-group']} onChange={onChange} value={selectedLabelList}>
                            {
                                labelList.map(label => {
                                    return (<Checkbox key={label.id} value={label.id} className={styles['svg-shape-checkbox']}>{label.name}</Checkbox>);
                                })
                            }
                        </Checkbox.Group>
                    </div>
                    <div className={styles['svg-shape-rightside']}>
                        <div className={styles['svg-shape-container']}>
                            {
                                svgList.map(v => {
                                    console.log(v);
                                    if (v.pathData) {
                                        return (
                                            <div className={styles['svg-shape-item']} key={v.id}>
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
                                                        // { [styles.selected]: extShape === key }
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
                                                key={v.id}
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
                            onChange={onPageChange}
                            current={page}
                        />
                    </div>
                </div>
            </div>
        </Spin>
    );
};

export default SVGShapeLibrary;
