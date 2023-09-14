import React, { useEffect, useRef, useState } from 'react';
import i18next from 'i18next';
import { Checkbox, Spin, message } from 'antd';
import classNames from 'classnames';
import _ from 'lodash';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import styles from './styles.styl';
import api from '../../../api';
import MainToolBar from '../../layouts/MainToolBar';
import i18n from '../../../lib/i18n';
import { IMG_RESOURCE_BASE_URL } from '../../../constants/downloadManager';

const SVGShapeLibrary = (props) => {
    const rightSideBlock = useRef();
    const [blockH, setBlockH] = useState(648);
    const [blockW, setBlockW] = useState(768);

    const [svgShapeCount, setSvgShapeCount] = useState(0);
    const [rowCount, setRowCount] = useState(8);
    const mainToolBarId = 'svg-shape-library-main-tool-bar';
    const [isLoading, setIsLoading] = useState(true);
    const [svgList, setSvgList] = useState([]);
    const svgListMap = useRef({});

    const [labelList, setLabelList] = useState([]);
    const [selectedLabelList, setSelectedLabelList] = useState([]);

    const [indeterminate, setIndeterminate] = useState(false);
    const [checkAll, setCheckAll] = useState(false);

    const getLabelList = async (query?: {labelIds?: number[], pageSize?: string}) => {
        const res = (await api.getSvgShapeLabelList(query)) as any;
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            return [];
        }
        const data = res.body.data;
        setLabelList(data);
        return data;
    };

    const getSvgList = async (query?: {labelIds?: number[], pageSize?: number, page?:number, start?: number, size?: number}, isRefresh: boolean = false) => {
        setIsLoading(true);
        if (query && Array.isArray(query.labelIds) && query.labelIds.includes(0)) query = null;
        const res = (await api.getSvgShapeList(query)) as any;
        if (!res.body || !res.body.data || !Array.isArray(res.body.data)) {
            setIsLoading(false);
            if (res.body && res.body.code !== 200) {
                message.error(res.body.msg);
            } else {
                message.error('get a null reslut, please try later.');
            }
            return [];
        }
        const data = res.body.data;
        res.body.total > 0 && setSvgShapeCount(res.body.total);

        if (isRefresh) {
            setSvgList(data);
            svgListMap.current = {};
        } else {
            setSvgList(pre => {
                const newData = [];
                data.forEach(item => {
                    if (svgListMap.current[item.id]) {
                        return;
                    }
                    newData.push(item);
                    svgListMap.current[item.id] = true;
                });
                return pre.concat(newData);
            });
        }
        setIsLoading(false);
        return data;
    };

    const onCheckAllChange = (e: CheckboxChangeEvent) => {
        setSelectedLabelList(e.target.checked ? labelList.map(v => v.id) : []);
        setIndeterminate(false);
        setCheckAll(e.target.checked);
        getSvgList({ labelIds: e.target.checked ? labelList.map(v => v.id) : [], pageSize: 100 }, true).catch(error => {
            message.error(error);
        });
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
                        const h = parseFloat(svgElement.getAttribute('height')); if (h > w) {
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
        getSvgList({ labelIds: checkedValues, pageSize: 100 }, true).catch(error => {
            message.error(error);
        });
        setCheckAll(sortedCheckedValues.length === labelList.length);
    };

    const handleResize = (() => {
        return _.debounce(() => {
            if (!rightSideBlock.current) return;
            const style = window.getComputedStyle(rightSideBlock.current);
            setBlockW(parseFloat(style?.width.slice(0, -2)));
            setBlockH(parseFloat(style?.height.slice(0, -2)));
            setRowCount(window.innerWidth > 1280 ? 8 : 5);
        }, 500);
    })();

    useEffect(() => {
        getLabelList({ pageSize: 1000 });
        // get svgshape count
        getSvgList({ pageSize: 100 }).catch(error => {
            message.error(error);
        });

        window.document.body.style.overflow = 'hidden';
        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.document.body.style.overflow = '';
            window.removeEventListener('resize', handleResize);
        };
    }, []);


    const isItemLoaded = index => {
        if (svgShapeCount > 0 && index * rowCount > svgShapeCount) {
            index = svgShapeCount - 1;
        }
        return !!svgList[index * rowCount];
    };
    const loadMoreItems = async (startIndex, stopIndex) => {
        return !isLoading && getSvgList({ labelIds: selectedLabelList, start: startIndex * rowCount, size: (stopIndex - startIndex) * rowCount })
            .catch(error => {
                message.error(error);
            });
    };

    const renderSvgShape = (row, col) => {
        const v = svgList[row * rowCount + col];
        // console.log('render', row, col, rowCount, row * rowCount + col);
        if (!v) return ('');
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
                        }
                    >
                        <path stroke="black" fill="none" strokeWidth="6.25" fillRule="evenodd" clipRule="evenodd" d={v.pathData} />
                    </svg>
                </div>
            );
        } else {
            return (
                <div
                    key={v.id}
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
    };

    return (
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
                <Spin spinning={isLoading}>
                    <div id="svg-shape-library" className={styles['svg-shape-content']}>
                        <div className={styles['svg-shape-leftside']}>
                            <h1>{i18n._('key-SvgShapeLibrary/Category')}</h1>
                            <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                                {i18n._('key-SvgShapeLibrary/All')}
                            </Checkbox>
                            <Checkbox.Group style={{ width: '100%', height: `${labelList?.length * 32}px` }} className={styles['svg-shape-checkbox-group']} onChange={onChange} value={selectedLabelList}>
                                {
                                    labelList.map(label => {
                                        return (<Checkbox key={`label${label.id}`} value={label.id} className={styles['svg-shape-checkbox']}>{label.name}</Checkbox>);
                                    })
                                }
                            </Checkbox.Group>
                        </div>
                        <div className={styles['svg-shape-rightside']} ref={rightSideBlock}>
                            <AutoSizer disableWidth disableHeight>
                                {() => (
                                    <InfiniteLoader
                                        isItemLoaded={isItemLoaded}
                                        itemCount={Math.ceil(svgShapeCount / rowCount) || 1000 / rowCount}
                                        loadMoreItems={loadMoreItems}
                                    >
                                        {({ onItemsRendered, ref }) => (
                                            <List
                                                className="List"
                                                height={blockH || 648}
                                                itemCount={Math.ceil(svgShapeCount / rowCount) || 1000 / rowCount}
                                                itemSize={() => blockW / rowCount || 100}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                width={blockW || 768}
                                            >
                                                {({ index, style }) => (
                                                    <div
                                                        key={new Array(rowCount).fill(1).map((v, columnIndex) => svgList[index * rowCount + columnIndex] && svgList[index * rowCount + columnIndex].id).join('-')}
                                                        data-key={new Array(rowCount).fill(1).map((v, columnIndex) => svgList[index * rowCount + columnIndex] && svgList[index * rowCount + columnIndex].id).join('-')}
                                                        style={{ ...style, display: 'flex', justifyContent: 'space-between' }}
                                                    >
                                                        {new Array(rowCount).fill(1).map((v, columnIndex) => renderSvgShape(index, columnIndex))}
                                                    </div>

                                                )}
                                            </List>
                                        )}
                                    </InfiniteLoader>
                                )}
                            </AutoSizer>
                        </div>
                    </div>
                </Spin>
            </div>
        </div>
    );
};

export default SVGShapeLibrary;
