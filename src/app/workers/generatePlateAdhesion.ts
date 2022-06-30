import generateSkirt, { IMessage as TSkirtMessage } from './plateAdhesion/generateSkirt';
import generateBrim, { IMessage as TBrimMessage } from './plateAdhesion/generateBrim';
import generateRaft, { IMessage as TRaftMessage } from './plateAdhesion/generateRaft';


export type IMessage = ({ adhesionType: 'skirt' } & TSkirtMessage)
    | ({ adhesionType: 'brim' } & TBrimMessage)
    | ({ adhesionType: 'raft' } & TRaftMessage)

const generatePlateAdhesion = (message: IMessage) => {
    switch (message.adhesionType) {
        case 'skirt':
            return generateSkirt(message);
        case 'brim':
            return generateBrim(message);
        case 'raft':
            return generateRaft(message);
        default:
            return null;
    }
};

export default generatePlateAdhesion;
