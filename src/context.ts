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
    sourceName,
} from './component'

// Data storage
export type LocalModel = { [key: string]: any }

/*
 * Produce a local model by resolving each path against state object.
 *
 */
function localModel(
    state: LocalModel,
    paths: PathMap,
    defaults: LocalModel = {},
) {
    return Object.keys(paths).reduce((acc, key) => {
        const path = paths[key]
        acc[key] = get(state, path, defaults[key])
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
function applyLocalModel(
    state: LocalModel,
    paths: PathMap,
    change: LocalModel,
): LocalModel {
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
 * Global state updates are performed with Immer library. This provides
 * seamless immutability.
 *
 * Returns a map of Connected Actions that mirrors input Actions Map.
 *
 */
function connectActions(
    state: LocalModel,
    paths: PathMap,
    defaults: LocalModel,
    actions: ActionMap,
    onUpdate: StateUpdateFn,
    source?: string,
): ConnectedActionMap {
    return Object.keys(actions).reduce((acc, name) => {
        const action = actions[name]
        const connectedAction = (...args) => {
            const model = localModel(state, paths, defaults)
            const change = produce(model, action(...args))
            state = applyLocalModel(state, paths, change)
            const actionInfo = {
                source: source,
                name: name,
            }
            onUpdate(state, actionInfo)
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
    state: LocalModel,
    cache: ContextCache,
    component: Component,
    tools: InstanceTools,
    onUpdate: StateUpdateFn,
): Instance {
    // Return cached Instance if we have it
    if (cache.instances[component.signature])
        return cache.instances[component.signature]

    // Otherwise create a new one and put it in cache
    const child = Object.keys(component.template.children).reduce(
        (acc, name) => {
            acc[name] = createInstance(
                state,
                cache,
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
        component.defaults,
        component.template.actions,
        onUpdate,
        sourceName(component),
    )

    if (action.$init) action.$init()

    const instance = (props: LocalModel = {}, outlet: Instance = () => {}) => {
        const model = localModel(state, component.paths, component.defaults)
        return component.template.render({
            model,
            action,
            child,
            props,
            create: (component: Component) =>
                createInstance(state, cache, component, tools, onUpdate),
            outlet,
            navigate: tools.navigate,
            link: tools.link,
        })
    }

    cache.instances[component.signature] = instance

    return instance
}

// Function that will be called when some Connected Action is finished.
export type StateUpdateFn = (
    state: LocalModel,
    info: { source: string; name: string },
) => void

// Context internal cache
export type ContextCache = {
    instances: { [key: string]: Instance }
}

// Context that glues together different Components
export type Context = {
    localModel: (paths: PathMap, defaults?: LocalModel) => LocalModel
    connectActions: (
        paths: PathMap,
        defaults: LocalModel,
        actions: ActionMap,
        signature?: string,
    ) => ConnectedActionMap
    triggerUpdate: () => void
    createInstance: (component: Component, tools?: InstanceTools) => Instance
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
    initialState: LocalModel,
    onUpdate: StateUpdateFn = () => {},
): Context {
    const cache: ContextCache = { instances: {} }
    const state = Object.assign({}, initialState)

    const actions = connectActions(
        state,
        {},
        {},
        {
            triggerUpdate: () => model => model,
        },
        onUpdate,
        'Context',
    )

    return {
        localModel: (paths: PathMap, defaults: LocalModel = {}) =>
            localModel(state, paths, defaults),
        connectActions: (
            paths: PathMap,
            defaults: LocalModel,
            actions: ActionMap,
            signature?: string,
        ) =>
            connectActions(
                state,
                paths,
                defaults,
                actions,
                onUpdate,
                signature,
            ),
        triggerUpdate: actions.triggerUpdate,
        createInstance: (component: Component, tools: InstanceTools = {}) =>
            createInstance(state, cache, component, tools, onUpdate),
    }
}
