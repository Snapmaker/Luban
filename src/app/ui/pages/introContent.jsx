import React from 'react';

/**
 * Get step intro node from text.
 *
 * @param text - text to be displayed.
 */
const getStepIntroFromText = (text) => (
    <div>
        {text}
    </div>
);

const printIntroStepOne = (text) => (
    <div>
        {text}
    </div>
);

const printIntroStepThree = (text1) => (
    <div>
        {text1}
    </div>
);
const printIntroStepFour = (text1) => (
    <div>
        {text1}
    </div>
);
const printIntroStepFive = (text1, text2) => (
    <div>
        <div>{text1}</div>
        <div>{text2}</div>
    </div>
);
const printIntroStepSix = (text1, text2, text3) => (
    <div>
        <div>{text1}</div>
        <div>{text2} <img src="/resources/images/guide-tours/icon_setting_32x32.png" alt="" className="width-32" /> {text3}</div>
    </div>
);

const printIntroStepSeven = (text1, text2, isOriginal) => (
    <div>
        <div>{text1}</div>
        <div>{text2}</div>
        <img src={isOriginal ? '/resources/images/guide-tours/printing_preview_original.png' : '/resources/images/guide-tours/printing-preview.png'} alt="" className="width-120" />
    </div>
);

const printIntroStepEight = (text1) => (
    <div>
        {text1}
    </div>
);
const printIntroStepNine = (text1) => (
    <div>
        {text1}
    </div>
);

const laserCncIntroStepOne = (text1, text2, text3, text4, text5, text6, text7 = null) => {
    return (
        <div className="laser-intro-one-content">
            <div className="top-content">
                <div>{text1}</div>
                <div>{text2}</div>
                <img src="/resources/images/guide-tours/pic_job_setup_3aix_size_102x102.png" alt="" className="width-102 job-setup-img" />
            </div>
            <div className="bottom-content">
                <div>{text3}</div>
                <ol>
                    <li>{text4}</li>
                    <li>{text5}</li>
                </ol>
                <div>{text6}</div>
                <img src="/resources/images/guide-tours/pic_job_setup_3aix_zero_102x102.png" alt="" className="width-102 job-setup-img" />
            </div>
            {
                text7 && (
                    <div className="margin-top-8">
                        <div>{text7}</div>
                    </div>
                )
            }
        </div>
    );
};
const laserCncIntroStepTwo = (text) => (
    <div>
        {text}
    </div>
);
const laserCncIntroStepFive = (text1, text2, text3) => {
    return (
        <div>
            <div>{text1}</div>
            <div>{text2}</div>
            <div className="laser-cnc-intro-step-five-bottom">
                <img src="/resources/images/guide-tours/pic_object_pressed_216x80.png" alt="" className="process-img" />
                <div className="text-3-wrapper">
                    <div className="text-3">{text3}</div>
                </div>
            </div>
        </div>
    );
};
const laserCncIntroStepSix = (text1, text2, isRotate, series, headType) => {
    let imgSrc = '';
    if (isRotate) {
        imgSrc = headType === 'cnc' ? '/resources/images/guide-tours/cnc_4_axis_priview.png' : '/resources/images/guide-tours/laser_4_axis_priview.png';
    } else {
        switch (series) {
            case 'Original':
            case 'Original Long Z-axis':
                imgSrc = headType === 'cnc' ? '/resources/images/guide-tours/original_cnc_3_axis_preview.png' : '/resources/images/guide-tours/original_laser_3_axis_preview.png';
                break;
            case 'A150':
                imgSrc = headType === 'cnc' ? '/resources/images/guide-tours/cnc_3_axis_priview.png' : '/resources/images/guide-tours/laser_3_axis_priview.png';
                break;
            default:
                imgSrc = headType === 'cnc' ? '/resources/images/guide-tours/a250_a350_cnc_3_axis_preview.png' : '/resources/images/guide-tours/laser_3_axis_priview.png';
                break;
        }
    }

    return (
        <div>
            <div>{text1}</div>
            <div>{text2}</div>
            <img src={imgSrc} alt="" className="width-120 margin-top-8 preview-img" />
        </div>
    );
};

const cncIntroStepTwo = (text) => (
    <div>
        {text}
    </div>
);

const laser4AxisStepOne = (text1, text2, text3) => {
    return (
        <div className="laser-intro-one-content-4-axis">
            <div className="top-content">
                <div>{text1}</div>
                <div>{text2}</div>
                <img src="/resources/images/guide-tours/pic_job_setup_4aix_size_330x128.png" alt="" className="intro-4-axis-big-img" />
            </div>
            <div className="bottom-content">
                <div>{text3}</div>
                <img src="/resources/images/guide-tours/pic_job_setup_4aix_zero_116x128.png" alt="" className="job-setup-img width-120" />
            </div>
        </div>
    );
};

const cnc4AxisStepOne = (text1, text2, text3) => {
    return (
        <div className="laser-intro-one-content-4-axis">
            <div className="top-content">
                <div>{text1}</div>
                <div>{text2}</div>
                <img src="/resources/images/guide-tours/pic_job_setup_4aix_size_330x128.png" alt="" className="intro-4-axis-big-img" />
            </div>
            <div className="bottom-content">
                <div>{text3}</div>
                <img src="/resources/images/cnc-laser/working-origin-cnc-4.png" alt="" className="job-setup-img width-120" />
            </div>
        </div>
    );
};

export {
    printIntroStepOne,
    getStepIntroFromText,
    printIntroStepThree,
    printIntroStepFour,
    printIntroStepFive,
    printIntroStepSix,
    printIntroStepSeven,
    printIntroStepEight,
    printIntroStepNine,
    laserCncIntroStepOne,
    laserCncIntroStepTwo,
    laserCncIntroStepFive,
    laserCncIntroStepSix,
    cncIntroStepTwo,
    laser4AxisStepOne,
    cnc4AxisStepOne
};
