import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import i18next from 'i18next';// import function to register Swiper custom elements
// import { register } from 'swiper/swiper-element.mjs';
import { Carousel } from 'antd';
import {
    FORUM_URL,
    MARKET_EN_URL,
    MARKET_ZH_URL,
    MYMINIFACTORY_URL,
    OFFICIAL_SITE_EN_URL,
    OFFICIAL_SITE_ZH_URL,
    SUPPORT_EN_URL,
    SUPPORT_ZH_URL,
    TUTORIAL_VIDEO_URL
} from '../../../constants';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import api from '../../../api';

// swiper register Swiper custom elements
// register();

const MoreInfo = () => {
    const lang = i18next.language;
    const [informationFlow, setInformationFlow] = useState({});
    const carouselRef = useRef();
    const carouselSeep = 5 * 1000;

    const supportURL = lang === 'zh-CN' ? SUPPORT_ZH_URL : SUPPORT_EN_URL;
    const websiteURL = lang === 'zh-CN' ? OFFICIAL_SITE_ZH_URL : OFFICIAL_SITE_EN_URL;
    const shopURL = lang === 'zh-CN' ? MARKET_ZH_URL : MARKET_EN_URL;

    let lastSlidePagination = null;
    let paginationInterverTimer = null;
    let paginationTimeoutTimer = null;
    const onCarouselAfterChange = () => {
        clearTimeout(paginationTimeoutTimer);
        clearInterval(paginationInterverTimer);
        lastSlidePagination && (lastSlidePagination.style.width = '');
        const currSlidePagination = document.querySelector('.slick-active button');
        let currProgress = 0;
        paginationInterverTimer = setInterval(() => {
            currProgress += 1;
            lastSlidePagination && (currSlidePagination.style.width = `${currProgress}%`);
        }, carouselSeep / 100);

        lastSlidePagination = currSlidePagination;

        // timer over
        paginationTimeoutTimer = setTimeout(() => {
            clearInterval(paginationInterverTimer);
            carouselRef.current.next();
        }, carouselSeep);
    };

    useEffect(() => {
        const init = async () => {
            const { body: data } = await api.getInformationFlow(lang);
            setInformationFlow(data);
        };
        init();

        const timer = setInterval(() => {
            if (carouselRef.current) {
                onCarouselAfterChange();
                clearInterval(timer);
            }
        }, 50);

        return () => {
            clearInterval(timer);
            clearTimeout(paginationTimeoutTimer);
            clearInterval(paginationInterverTimer);
        };
    });

    return (
        <div className={styles['more-info']}>
            <div className={classNames('highlight-heading', 'margin-bottom-16')}>
                {i18n._('key-HomePage/Begin-Help')}
            </div>
            {informationFlow && (
                <div className={styles['information-flow']}>
                    {/* customPaging={renderPagination} */}
                    <Carousel
                        ref={carouselRef}
                        draggable
                        className={styles['swiper-container']}
                        afterChange={onCarouselAfterChange}
                    >
                        {
                            informationFlow?.swiper?.map(swiper => {
                                return (
                                    <div className={classNames(styles['swiper-slide'])} key={swiper.title}>
                                        <div className="sm-flex justify-space-between sm-flex-direction-c">
                                            <div style={{ marginRight: '27px' }}>
                                                <div className={styles['swiper-title']}>{swiper.title}</div>
                                                <div className={styles['swiper-desc']}>{swiper.desc}</div>
                                            </div>
                                            <a className={styles['swiper-a']} href={swiper.btn.href} target="_blank" rel="noopener noreferrer">{`${swiper.btn.text} >`} </a>
                                        </div>
                                        <div className={styles['swiper-img']}>
                                            <img className="width-percent-100" src={swiper.imgSrc} alt={swiper.title} />
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </Carousel>


                    {/* <swiper-container pagination spaceBetween="24" class={styles['swiper-container']}>
                    {
                        informationFlow?.swiper?.map(swiper => {
                            return (
                                <swiper-slide class={styles['swiper-slide']}>
                                    <div className="sm-flex justify-space-between sm-flex-direction-c">
                                        <div>
                                            <div className={styles['swiper-title']}>{swiper.title}</div>
                                            <div className={styles['swiper-desc']}>{swiper.desc}</div>
                                        </div>
                                        <a className={styles['swiper-a']} href={swiper.btn.href} target="_blank" rel="noopener noreferrer">{`${swiper.btn.text} >`} </a>
                                    </div>
                                    <img className={styles['swiper-img']} src={swiper.imgSrc} alt={swiper.title} />
                                </swiper-slide>
                            );
                        })
                    }
                </swiper-container> */}
                    <div className={styles['blocks-wrapper']}>
                        {
                            informationFlow?.blocks?.map(block => {
                                return (
                                    <div className={styles['block-container']} key={block.title}>
                                        <div>
                                            <div className={styles['block-title']}>{block.title}</div>
                                            <div className={styles['block-desc']}>{block.desc}</div>
                                        </div>
                                        <a className={styles['block-a']} href={block?.btn?.href} target="_blank" rel="noopener noreferrer">{`${block?.btn?.text} >`} </a>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            )}
            {!informationFlow && (
                <div className={classNames(styles['resource-list'])}>
                    <a href="https://support.snapmaker.com/hc/en-us/articles/4406229926935" target="_blank" rel="noopener noreferrer" className={classNames(styles.listItem)}>
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Software Manual')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem, styles['right-part'])} href={supportURL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Support')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem)} href={TUTORIAL_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Video Tutorial')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem, styles['right-part'])} href={FORUM_URL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Forum')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem)} href={websiteURL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Snapmaker.com')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem, styles['right-part'])} href={shopURL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-Store')}
                        </span>
                    </a>
                    <a className={classNames(styles.listItem)} href={MYMINIFACTORY_URL} target="_blank" rel="noopener noreferrer">
                        <span className={classNames('heading-3-normal-with-hover')}>
                            {i18n._('key-HomePage/Begin-MyMiniFactory')}
                        </span>
                    </a>
                </div>
            )}
        </div>
    );
};

export default MoreInfo;
