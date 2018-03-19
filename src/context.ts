import get from 'lodash.get'
import set from 'lodash.set'
import produce from 'immer'
import { Action, ActionMap, PathMap } from './component'

export type Model = { [key: string]: any }

/*
 * Produce a local model by resolving each path against state object.
 *
 */
function localModel(state, paths) {
    return Object.keys(paths).reduce((acc, key) => {
        const path = paths[key]
        acc[key] = get(state, path)
        return acc
    }, {})
}


/*
 * Apply local model to global state.
 *
 * This should be the only place that mutates state.
 *
 */
function applyLocalModel(state: Model, paths: PathMap, change: Model): Model {
    return Object.keys(paths).reduce((acc, name) => {
        return set(acc, paths[name], change[name])
    }, state)
}

/*
 * Connect action functions to context
 *
 * We use Immer library here to make local model immutable.
 *
 */

export type ConnectedAction = (...args) => void
export type ConnectedActionMap = {[key: string]: ConnectedAction}

function connectActions(
    state: Model,
    paths: PathMap,
    actions: ActionMap,
): ConnectedActionMap {
    return Object.keys(actions).reduce((acc, name) => {
        const action = actions[name]
        const connectedAction = (...args) => {
            const model = localModel(state, paths)
            const change = produce(model, action(...args))
            state = applyLocalModel(state, paths, change)
        }
        acc[name] = connectedAction
        return acc
    }, {})
}

/*
 * Create context and return a bunch of context-aware functions.
 * This is in practice an 'application instance'.
 *
 */

export type Context = {
    localModel: (paths: PathMap) => Model
    connectActions: (paths: PathMap, actions: ActionMap) => ConnectedActionMap
}

export function createContext(initialState: Model): Context {
    // Internals of this state object will be mutated, but it should never leak
    // outside on its own.
    const state = Object.assign({}, initialState)

    return {
        localModel: (paths: PathMap) => localModel(state, paths),
        connectActions: (paths: PathMap, actions: ActionMap) =>
            connectActions(state, paths, actions),
    }
}
