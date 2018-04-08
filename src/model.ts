function modelPath(name: string) {
    return ['$model', name]
}

export type DataModel = {
    path: string[]
}

export function createModel(name: string): DataModel {
    return {
        path: modelPath(name),
    }
}
