export type Context = {
    state: {[key: string]: any}
}

export function createContext(initialState: {[key: string]: any}): Context {
    return {
        state: Object.assign({}, initialState)
    }
}
