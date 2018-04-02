import get from 'lodash.get'
import set from 'lodash.set'
import produce from 'immer'
import {
    Action,
    ActionMap,
    PathMap,
    Component,
    Instance,
    InstanceTools,
} from './component'

// Data storage
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
 * Apply Local Model to Global State.
 *
 * Looks at each field in Local Model and puts it back according
 * to Component path with the same name.
 * 
 * Will not touch the field in Global State if it's omitted from Local Model.
 * So if an action wants to ignore some parts of local model, it should make
 * sure not to return corresponding fields.
 *
 */
function applyLocalModel(state: Model, paths: PathMap, change: Model): Model {
    return Object.keys(paths).reduce((acc, name) => {
        if (change.hasOwnProperty(name))
            return set(acc, paths[name], change[name])
        return acc
    }, state)
}

// Action wired to Context
export type ConnectedAction = (...args) => void
// A map of named Connected Actions
export type ConnectedActionMap = { [key: string]: ConnectedAction }

/*
 * Connect Actions to Context.
 *
 * Changes Template Actions into Connected Actions by wrapping their
 * execution in a function. In that function we resolve Local Model,
 * run the Action against it, and sync the result back into Global State.
 * 
 * As soon as Connected Action is finished we call Context's onUpdate
 * function.
 * 
 * Result of running an Action is always treated as a Promise. So changes
 * to Global State and calling of onUpdate will happen on the next tick
 * of Event Loop.
 * 
 * If signature was passed we put it into contextState.lastActionOwner to
 * indicate which Component is responsible for last completed Action.
 * This is used to calculate which Instances need to recalculate their
 * render functions and update Context's Render Cache.
 *
 * Returns a map of Connected Actions that mirrors input Actions Map.
 *
 */
function connectActions(
    state: Model,
    paths: PathMap,
    actions: ActionMap,
    onUpdate: StateUpdateFn,
    signature?: string,
): ConnectedActionMap {
    return Object.keys(actions).reduce((acc, name) => {
        const action = actions[name]
        const connectedAction = (...args) => {
            const model = localModel(state, paths)
            Promise.resolve(action(...args)(model)).then(change => {
                state = applyLocalModel(state, paths, change)
                onUpdate(state)
            })
        }
        acc[name] = connectedAction
        return acc
    }, {})
}

/*
 * Create Component Instance.
 *
 * Also does some bookkeeping:
 * - Registers component in context
 * - Updates all component dependencies
 * - Caches the new Instance
 * - When instance is rendered, caches the rendering value
 *
 */
function createInstance(
    state: Model,
    component: Component,
    tools: InstanceTools,
    onUpdate: StateUpdateFn,
): Instance {
    const child = Object.keys(component.template.children).reduce(
        (acc, name) => {
            acc[name] = createInstance(
                state,
                component.template.children[name],
                tools,
                onUpdate,
            )
            return acc
        },
        {},
    )

    const action = connectActions(
        state,
        component.paths,
        component.template.actions,
        onUpdate,
        component.signature,
    )

    if (action.$init) action.$init()

    const instance = (props: Model = {}, outlet: Instance = () => {}) => {
        const model = localModel(state, component.paths)
        return component.template.render({
            model,
            action,
            child,
            props,
            create: (component: Component) =>
                createInstance(state, component, tools, onUpdate),
            outlet,
            navigate: tools.navigate,
            link: tools.link,
        })
    }

    return instance
}

// Function that will be called when some Connected Action is finished.
export type StateUpdateFn = (state: Model) => void

// Context that glues together different Components
export type Context = {
    localModel: (paths: PathMap) => Model
    connectActions: (
        paths: PathMap,
        actions: ActionMap,
        signature?: string,
    ) => ConnectedActionMap
    createInstance: (component: Component, tools: InstanceTools) => Instance
}

/*
 * Create context and return a bunch of context-aware functions.
 *
 * Context takes in initial state and update callback.
 *
 * Update callback will be called after every Action. In practice only
 * Actions can change Global State. Global State is available inside of
 * onUpdate callback, but it's not recommended to mutate it there. Such 
 * mutations will not be tracked.
 *
 */
export function createContext(
    initialState: Model,
    onUpdate: StateUpdateFn = () => {},
): Context {
    const state = Object.assign({}, initialState)

    return {
        localModel: (paths: PathMap) => localModel(state, paths),
        connectActions: (
            paths: PathMap,
            actions: ActionMap,
            signature?: string,
        ) => connectActions(state, paths, actions, onUpdate, signature),
        createInstance: (component: Component, tools: InstanceTools) =>
            createInstance(state, component, tools, onUpdate),
    }
}
