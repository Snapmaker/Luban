
export const CaseConfigOriginal = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printed Fabric',
        imgSrc: '../../images/user-case/Origin/3D-Origin.jpg',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/Origin/Original_3DP.snap3dp',
            name: 'Original_3DP.snap3dp'
        }
    },
    {
        tag: 'laser',
        title: 'Laser Engraved Feather',
        mode: 'greyscale', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/Origin/Laser-Origin.jpg',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/Origin/Original_Laser.snaplzr',
            name: 'Original_Laser.snaplzr'
        }
    },
    {
        tag: 'cnc',
        title: 'CNC Cut Sign',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/Origin/CNC-Origin.jpg',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/Origin/Original_CNC.snapcnc',
            name: 'Original_CNC.snapcnc'
        }
    }
];

export const CaseConfig150 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printed Spiral Vase',
        imgSrc: '../../images/user-case/A150/3D-A150.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A150/A150_3DP.snap3dp',
            name: 'A150_3DP.snap3dp'
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cut Gift Box',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/Laser-A150.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A150/A150_Laser.snaplzr',
            name: 'A150_Laser.snaplzr'
        }
    },
    {
        tag: 'cnc',
        title: 'CNC Cut Keychain',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A150/CNC-A150.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A150/A150_CNC.snapcnc',
            name: 'A150_CNC.snapcnc'
        }
    }
];

export const CaseConfig250 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printed Spiral Vase',
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/A250_3DP.snap3dp',
            name: 'A250_3DP.snap3dp'
        }

    },
    {
        tag: 'laser',
        title: 'Laser Cut Gift Box',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/Laser-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/A250_Laser.snaplzr',
            name: 'A250_Laser.snaplzr'
        }

    },
    {
        tag: 'cnc',
        title: 'CNC Cut Smartphone Holder',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/A250_CNC.snapcnc',
            name: 'A250_CNC.snapcnc'
        }

    }
];

export const CaseConfig350 = [
    {
        tag: '3dp', // 3dp、laser、cnc
        title: '3D Printed Spiral Vase',
        imgSrc: '../../images/user-case/A250/3D-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A350/A350_3DP.snap3dp',
            name: 'A350_3DP.snap3dp'
        }
    },
    {
        tag: 'laser',
        title: 'Laser Cut Gift Box',
        // sourceType: 'svg', // raster/svg/text
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/Laser-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A350/A350_Laser.snaplzr',
            name: 'A350_Laser.snaplzr'
        }

    },
    {
        tag: 'cnc',
        title: 'CNC Cut Smartphone Holder',
        mode: 'vector', // mode: 'vector','greyscale','bw','text','trace'
        imgSrc: '../../images/user-case/A250/CNC-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A350/A350_CNC.snapcnc',
            name: 'A350_CNC.snapcnc'
        }

    }
];
const DEFAULT_CASE = [
    {
        tag: 'cnc',
        title: 'Rotary CNC Carved Chess Piece',
        mode: 'greyscale', // mode:     path: /UserCase/A250/',
        imgSrc: '../../images/user-case/FourAxis/4th-CNC-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/4th_CNC.snapcnc',
            name: '4th_lion_CNC.snapcnc'
        }
    },
    {
        tag: 'cnc',
        title: '4-axis Linkage CNC Carved Lion',
        mode: 'greyscale', // mode: 'vec    path: /UserCase/A250/',
        imgSrc: '../../images/user-case/FourAxis/4th-CNC-Gcode-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/4th_lion_CNC.snapcnc',
            name: '4th_CNC.snapcnc'
        }

    }
];
export const CaseConfigA250FourAxis = [
    ...DEFAULT_CASE,
    {
        tag: 'laser',
        title: 'Rotary Laser Engraved Lion',
        // sourceType: 'svg', // raster/svg/text
        mode: 'greyscale', // mode: 'v
        imgSrc: '../../images/user-case/FourAxis/4th-Laser-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A250/A250_4th_Laser.snaplzr',
            name: 'A250_4th_Laser.snaplzr'
        }
    }
];

export const CaseConfigA350FourAxis = [
    ...DEFAULT_CASE,
    {
        tag: 'laser',
        title: 'Rotary Laser Engraved Lion',
        // sourceType: 'svg', // raster/svg/text
        mode: 'greyscale', // mode: 'v
        imgSrc: '../../images/user-case/FourAxis/4th-Laser-A250&A350.png',
        pathConfig: {
            isDatastoragePath: true,
            path: './UserCase/A350/A350_4th_Laser.snaplzr',
            name: 'A350_4th_Laser.snaplzr'
        }
    }
];
