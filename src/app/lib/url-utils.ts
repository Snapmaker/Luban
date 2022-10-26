import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../constants/machines';

export function getCurrentHeadType(pathname) {
    if (!pathname) {
        return null;
    }
    let headType: string;
    if (pathname.indexOf(HEAD_CNC) >= 0) headType = HEAD_CNC;
    if (pathname.indexOf(HEAD_LASER) >= 0) headType = HEAD_LASER;
    if (pathname.indexOf(HEAD_PRINTING) >= 0) headType = HEAD_PRINTING;
    return headType;
}

export default {};
