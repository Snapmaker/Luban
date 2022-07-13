declare const uploadImage: (data: FormData) => Promise<{
    body: {
        originalName: string;
        uploadName: string;
        width: number;
        height: number;
        paths?: string[];
    }
}>;



export default {
    uploadImage
}