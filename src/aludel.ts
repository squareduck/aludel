//
// # Notes
//
// Route can create actions with the same local model as its component
//
//
// const tasksTemplate = {
//     sockets: ['views'],
//     actions: () => ({
//         '@init': () => (model) => {
//             if (!model.views) {
//                 return model.set('views', {1: {name: 'All', rule: 'all'}})
//             }
//             return model
//         }
//     }),
//     render: ({outlet}) => m('div', outlet())

// const tasksComponent = {
//     template: tasksTemplate,
//     sockets: {
//         'views': ['tasks', 'views']
//     }
// }
//
//
// const router = {
//     '/': '/tasks',
//     '/tasks': {name: 'Tasks', component: tasksComponent, subroutes: {
//         '/views/:id': {name: 'TaskView', component: taskView, subroutes: {
//             '/task/:id': {name: 'TaskInfo', component: taskInfo}
//         }}
//     }}
// }

// createApp(layoutComponent, router)
//
import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'

export type Model = Immutable.ImmutableObject<{[key: string]: any}>
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, component: Component) => any

export interface ComponentTemplate {
    sockets: string[]
    actions: ActionMap
    render: RenderFn
}

export interface ComponentConfig {
    template: ComponentTemplate
    paths: SocketMap
}

export interface RenderTools {
    actions: ActionMap
    outlet: Component
    model: Model
}

export type Component = () => any
export type RenderFn = (tools: RenderTools) => any
export type Action = (...args: any[]) => (model: Model) => Model
export type ActionMap = {[key: string]: Action}
export type SocketMap = {[key: string]: string[]}

export type RouteMap = {[key: string]: Route}
export interface Route {
    name: string
    component: ComponentConfig
    subroutes: RouteMap
}

export type FlatRouteMap = {[key: string]: FlatRoute}
export interface FlatRoute {
    path: string
    name: string
}

export const createApp = (
    renderer: RendererFn,
    initialModel: {[key: string]: any},
) => {
    // Step over whole routes tree and create components injected with outlet functions that depend on relevant route changes
    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = (currentModel: Model, modelUpdate: UpdateFn) => modelUpdate(currentModel)

    const modelStream = flyd.scan<Model, UpdateFn>(applyUpdate, Immutable(initialModel), updateStream)

    const localModel = (sockets: string[], paths: SocketMap) =>
        sockets.reduce(
            (acc, socket) => acc.set(socket, modelStream().getIn(paths[socket])),
            Immutable({}) as Model
        )

    const syncModel = (local: Model, sockets: string[], paths: SocketMap) => (global: Model) =>
        sockets.reduce(
            (acc, socket) => {
                if (paths[socket]) return acc.setIn(paths[socket], local[socket])
                return acc
            },
            global
        )

    const createComponent = (template: ComponentTemplate, paths: SocketMap): Component => {
        const model = () => localModel(template.sockets, paths)

        const actions = Object
            .keys(template.actions)
            .reduce(
                (acc, action) => {
                    const postActionModel = (...args: any[]) => template.actions[action](...args)(localModel(template.sockets, paths))
                    acc[action] = (...args: any[]) => updateStream(syncModel(postActionModel(...args), template.sockets, paths))
                    return acc
                },
                {} as any
            )

        if (actions['@init']) actions['@init']()

        return () => template.render({model: model(), actions, outlet: () => []})
    }

    const start = (rootElement: HTMLElement, component: Component) => {
        modelStream.map(model => renderer(rootElement, component))
    }

    return {
        createComponent,
        start
    }
}
