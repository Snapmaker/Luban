import { Machine, MachineGcodeFlavor, MachineType } from '@snapmaker/luban-platform';
import { L20WLaserToolModule, L40WLaserToolModule } from './snapmaker-2-toolheads';


export const machine: Machine = {
    identifier: 'Ray',

    fullName: 'Snapmaker Ray',
    machineType: MachineType.Laser,

    img: '/resources/images/machine/snapmaker_ray.jpeg',

    metadata: {
        size: { x: 600, y: 400, z: 0 },

        toolHeads: [
            {
                identifier: L20WLaserToolModule.identifier,
                configPath: 'laser/snapmaker_ray_20w',
                goHomeOnConnection: false,
            },
            {
                identifier: L40WLaserToolModule.identifier,
                configPath: 'laser/snapmaker_ray_40w',
                goHomeOnConnection: false,
            },
        ],

        gcodeFlavor: MachineGcodeFlavor.GRBL,

        disableWorkflowControl: true,

        serialPortBaudRate: 460800,
    },
};
